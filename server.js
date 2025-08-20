const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const DatabaseManager = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 先声明 sendProgress 函数
let sendProgress;

const dbManager = new DatabaseManager((sessionId, data) => {
    if (sendProgress) {
        sendProgress(sessionId, data);
    }
});

// 中间件
app.use(cors());
app.use(express.json({ limit: '2gb' })); // 增加JSON请求体大小限制到2GB
app.use(express.urlencoded({ limit: '2gb', extended: true })); // 增加URL编码请求体大小限制到2GB
app.use(express.static('public'));

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024 // 10GB文件大小限制 (高内存服务器)
  }
});

// 检查文件是否是测试格式
function isTestFormat(filePath) {
  try {
    // 读取文件的前几KB来检查格式
    const stats = fs.statSync(filePath);
    const readSize = Math.min(4096, stats.size); // 读取前4KB或整个文件
    
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, readSize, 0);
    fs.closeSync(fd);
    
    const sample = buffer.slice(0, bytesRead).toString('utf8');
    
    // 检查是否包含测试格式的标记
    const hasTestMarkers = sample.includes('### INSERT INTO') || 
                          sample.includes('### UPDATE') || 
                          sample.includes('### DELETE FROM') ||
                          sample.includes('BINLOG') ||
                          sample.includes('/*!50530 SET @@SESSION.PSEUDO_SLAVE_MODE=1*/');
    
    // 检查是否是二进制文件（包含不可打印字符）
    const isBinary = buffer.some(byte => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13);
    
    // 如果包含测试标记且不是二进制文件，则认为是测试格式
    return hasTestMarkers && !isBinary;
  } catch (error) {
    console.error('检查文件格式失败:', error);
    return false;
  }
}

// 解析binlog文件
function parseBinlog(filePath, progressSessionId = null) {
  return new Promise((resolve, reject) => {
    // 检查文件大小
    const stats = fs.statSync(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`文件大小: ${fileSizeInMB.toFixed(2)} MB`);
    
    // 检查是否是测试格式
    if (isTestFormat(filePath)) {
      console.log('检测到测试格式的binlog文件，直接解析...');
      // 对于测试格式，直接读取文件
      const fileContent = fs.readFileSync(filePath, 'utf8');
      resolve(fileContent);
      return;
    }
    
    console.log('检测到二进制binlog文件，使用mysqlbinlog工具解析...');
    
    // Docker环境检测
    const isDocker = fs.existsSync('/.dockerenv');
    if (isDocker) {
      console.log('检测到Docker环境，使用优化配置...');
    }
    
    // 使用mysqlbinlog工具解析，添加更多参数来获取时间信息
    const mysqlbinlog = spawn('mysqlbinlog', [
      '-v', 
      '--base64-output=DECODE-ROWS',
      filePath
    ]);
    let output = '';
    let error = '';
    let outputSize = 0;
    const maxOutputSize = 5 * 1024 * 1024 * 1024; // 5GB输出限制 (高内存服务器)

    mysqlbinlog.stdout.on('data', (data) => {
      const chunk = data.toString();
      outputSize += chunk.length;
      
      if (outputSize > maxOutputSize) {
        mysqlbinlog.kill();
        reject(new Error('解析输出过大，超过200MB限制。请考虑分割binlog文件或增加服务器内存。'));
        return;
      }
      
      output += chunk;
    });

    mysqlbinlog.stderr.on('data', (data) => {
      error += data.toString();
    });

    mysqlbinlog.on('close', (code) => {
      if (code !== 0) {
        console.error(`mysqlbinlog错误详情:`);
        console.error(`  退出代码: ${code}`);
        console.error(`  错误信息: ${error}`);
        console.error(`  文件路径: ${filePath}`);
        reject(new Error(`mysqlbinlog解析失败: ${error || '未知错误'}`));
      } else {
        console.log(`解析完成，输出大小: ${(outputSize / (1024 * 1024)).toFixed(2)} MB`);
        resolve(output);
      }
    });

    mysqlbinlog.on('error', (err) => {
      reject(new Error(`mysqlbinlog执行失败: ${err.message}`));
    });
  });
}

// 解析SQL操作
function parseOperations(binlogOutput, progressSessionId = null) {
  const operations = [];
  const lines = binlogOutput.split('\n');
  const totalLines = lines.length;
  let currentOperation = null;
  let currentTimestamp = null;
  let currentServerId = null;
  let currentSection = null; // 'SET' 或 'WHERE'
  let processedLines = 0;
  let operationTimestamp = null; // 为当前操作保留的时间戳
  let currentXid = null; // 当前事务ID
  let currentGtid = null; // 当前GTID
  
  console.log(`开始解析 ${totalLines} 行binlog输出...`);
  
  // 调试：显示前几行内容来了解格式（仅在调试模式下）
  if (process.env.DEBUG) {
    console.log('Binlog输出样本（前10行）:');
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].trim()) {
        console.log(`  ${i}: ${lines[i].trim()}`);
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    processedLines++;

    // 每处理1000行显示一次进度
    if (processedLines % 1000 === 0) {
      const progress = ((processedLines / totalLines) * 100).toFixed(1);
      console.log(`解析进度: ${progress}% (${processedLines}/${totalLines})`);
      
      // 发送进度更新
      if (progressSessionId) {
        sendProgress(progressSessionId, {
          type: 'parsing',
          stage: '解析binlog文件',
          progress: parseFloat(progress), // 直接使用计算出的百分比
          processed: processedLines,
          total: totalLines,
          message: `解析进度: ${progress}% (${processedLines.toLocaleString()}/${totalLines.toLocaleString()})`
        });
      }
    }

    // 内存监控，高内存服务器配置
    if (operations.length > 0 && operations.length % 10000 === 0) {
      const currentMemory = getMemoryUsage();
      console.log(`已解析 ${operations.length} 个操作，内存使用: ${currentMemory.heapUsed} MB`);
      
      // 128GB内存服务器，允许使用更多内存
      if (currentMemory.heapUsed > 20000) { // 20GB限制
        console.log('警告: 内存使用超过20GB，建议使用数据库存储');
        // 不停止解析，只是警告
      }
    }

    // 解析事务ID (Xid)
    if (line.includes('Xid = ')) {
      const xidMatch = line.match(/Xid = (\d+)/);
      if (xidMatch) {
        currentXid = xidMatch[1];
      }
    }
    
    // 解析GTID
    if (line.includes('GTID') && line.includes('=')) {
      const gtidMatch = line.match(/GTID\s*=\s*([^\s,]+)/);
      if (gtidMatch) {
        currentGtid = gtidMatch[1];
      }
    }
    
    // 解析时间戳 - 支持多种格式
    if (line.startsWith('#') && line.includes('server id')) {
      // 匹配各种可能的时间戳格式
      let timestampMatch = null;
      
      // 格式1: #241201 10:30:20 server id 1 (YYMMDD HH:MM:SS)
      timestampMatch = line.match(/#(\d{6})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      
      if (!timestampMatch) {
        // 格式2: #2024-12-01 10:30:20 server id 1 (YYYY-MM-DD HH:MM:SS)
        timestampMatch = line.match(/#(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (!timestampMatch) {
        // 格式3: #1733040620 server id 1 (Unix时间戳)
        timestampMatch = line.match(/#(\d{10})\s+server id\s+(\d+)/);
        if (timestampMatch) {
          // 为Unix时间戳格式添加虚拟时间部分
          timestampMatch = [timestampMatch[0], timestampMatch[1], '00:00:00', timestampMatch[2]];
        }
      }
      
      if (!timestampMatch) {
        // 格式4: #1733040620 10:30:20 server id 1 (Unix时间戳 + 时间)
        timestampMatch = line.match(/#(\d{10})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (!timestampMatch) {
        // 格式5: 通用数字格式 #数字 时间 server id
        timestampMatch = line.match(/#(\d+)\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (timestampMatch) {
        const dateTimeStr = timestampMatch[1];
        const timeStr = timestampMatch[2];
        currentServerId = timestampMatch[3];
        
        if (process.env.DEBUG) {
          console.log(`调试时间戳解析: 行="${line}"`);
          console.log(`  -> 原始="${dateTimeStr}", 时间="${timeStr}", 服务器ID="${currentServerId}"`);
        }
        
        // 处理不同的时间格式
        if (dateTimeStr.length === 6 && /^\d{6}$/.test(dateTimeStr)) {
          // 格式: YYMMDD (如 241201)
          const year = '20' + dateTimeStr.substring(0, 2);
          const month = dateTimeStr.substring(2, 4);
          const day = dateTimeStr.substring(4, 6);
          currentTimestamp = `${year}-${month}-${day} ${timeStr}`;
        } else if (dateTimeStr.length === 10 && /^\d{10}$/.test(dateTimeStr)) {
          // Unix时间戳 (10位数字)
          const unixTimestamp = parseInt(dateTimeStr);
          if (unixTimestamp > 946684800) { // 2000年1月1日的时间戳
            const date = new Date(unixTimestamp * 1000);
            // 如果有时间部分，使用时间部分，否则使用Unix时间戳的时间
            if (timeStr && timeStr !== '00:00:00') {
              const dateStr = date.toISOString().slice(0, 10);
              currentTimestamp = `${dateStr} ${timeStr}`;
            } else {
              currentTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');
            }
          } else {
            currentTimestamp = `${dateTimeStr} ${timeStr}`;
          }
        } else if (dateTimeStr.includes('-')) {
          // 已经是标准日期格式 YYYY-MM-DD
          currentTimestamp = `${dateTimeStr} ${timeStr}`;
        } else if (dateTimeStr.length === 8 && /^\d{8}$/.test(dateTimeStr)) {
          // 格式: YYYYMMDD (如 20241201)
          const year = dateTimeStr.substring(0, 4);
          const month = dateTimeStr.substring(4, 6);
          const day = dateTimeStr.substring(6, 8);
          currentTimestamp = `${year}-${month}-${day} ${timeStr}`;
        } else {
          // 其他格式，尝试直接解析
          currentTimestamp = `${dateTimeStr} ${timeStr}`;
        }
      }
    }
    
    // 额外检查：从SET TIMESTAMP语句中解析时间戳
    if (line.includes('SET TIMESTAMP=')) {
      const timestampMatch = line.match(/SET TIMESTAMP=(\d+)/);
      if (timestampMatch) {
        const unixTimestamp = parseInt(timestampMatch[1]);
        if (unixTimestamp > 946684800) { // 2000年1月1日后
          const date = new Date(unixTimestamp * 1000);
          const newTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');
          // 总是更新时间戳，SET TIMESTAMP是最准确的
          currentTimestamp = newTimestamp;
          if (process.env.DEBUG) {
            console.log(`从SET TIMESTAMP解析: ${unixTimestamp} -> ${newTimestamp}`);
          }
        }
      }
    }
    
    // 额外检查：如果没有找到时间戳，尝试从其他行解析
    if (!currentTimestamp && line.startsWith('#') && line.match(/\d{4}-\d{2}-\d{2}/)) {
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        currentTimestamp = `${dateMatch[1]} ${dateMatch[2]}`;
        if (process.env.DEBUG) {
          console.log(`从其他行解析时间戳: ${currentTimestamp}`);
        }
      }
    }

    // 检测事务边界或新操作，保存上一个操作
    const isNewOperation = line.includes('### INSERT INTO') || line.includes('### UPDATE') || line.includes('### DELETE FROM');
    const isTransactionBoundary = line.includes('COMMIT') || line.includes('BEGIN') || line.includes('ROLLBACK') || 
                                 line.includes('# at ') || line.includes('server id') || 
                                 (line.startsWith('#') && line.includes('end_log_pos'));
    
    // 先保存上一个操作（在创建新操作或遇到事务边界时）
    if (currentOperation && (isNewOperation || isTransactionBoundary)) {
      // 检查操作是否有数据
      const hasData = (currentOperation.type === 'UPDATE' && 
                      (currentOperation.setValues.length > 0 || currentOperation.whereConditions.length > 0)) ||
                     ((currentOperation.type === 'INSERT' || currentOperation.type === 'DELETE') && 
                      currentOperation.values.length > 0);
      
      if (hasData) {
        generateSQLStatements(currentOperation);
        operations.push(currentOperation);
        if (operations.length % 100 === 0) {
          console.log(`已保存 ${operations.length} 个操作...`);
          
          // 发送操作提取进度
          if (progressSessionId) {
            sendProgress(progressSessionId, {
              type: 'extracting',
              stage: '提取操作',
              operations: operations.length,
              message: `已提取 ${operations.length} 个操作`
            });
          }
        }
      }
      currentOperation = null;
    }
    
    // 检测操作类型
    if (isNewOperation) {
      currentSection = null;
      const operationType = line.includes('INSERT') ? 'INSERT' : 
                           line.includes('UPDATE') ? 'UPDATE' : 'DELETE';
      const tableMatch = line.match(/###\s+(INSERT INTO|UPDATE|DELETE FROM)\s+`?([^`\s]+)`?\.`?([^`\s]+)`?/);
      
      // 为新操作获取当前最新的时间戳（创建时的快照）
      const operationTimestamp = currentTimestamp; // 使用当前时间戳的快照
      
      // 为每个操作创建独立的时间戳副本
      currentOperation = {
        type: operationType,
        database: tableMatch ? tableMatch[2] : 'unknown',
        table: tableMatch ? tableMatch[3] : 'unknown',
        timestamp: operationTimestamp, // 使用创建时的时间戳快照
        serverId: currentServerId,
        xid: currentXid, // 事务ID
        gtid: currentGtid, // GTID
        setValues: [],      // UPDATE操作的新值
        whereConditions: [], // WHERE条件（旧值）
        values: [],         // INSERT/DELETE的值
        originalSQL: '',
        reverseSQL: ''
      };
      
      if (process.env.DEBUG && operations.length < 5) {
        console.log(`创建操作 #${operations.length + 1}: ${operationType} ${currentOperation.database}.${currentOperation.table} 时间: ${operationTimestamp}`);
      }
      
      if (operations.length % 100 === 0 && operations.length > 0) {
        console.log(`已创建 ${operations.length} 个操作...`);
      }
    }

    // 检测SET部分（UPDATE操作的新值）
    if (line.includes('### SET')) {
      currentSection = 'SET';
      continue;
    }

    // 检测WHERE部分（UPDATE操作的旧值）
    if (line.includes('### WHERE')) {
      currentSection = 'WHERE';
      continue;
    }

    // 解析列和值
    if (currentOperation && line.startsWith('###   @')) {
      const columnMatch = line.match(/###\s+@(\d+)=(.+)/);
      if (columnMatch) {
        const columnIndex = parseInt(columnMatch[1]);
        const value = columnMatch[2];
        
        if (currentOperation.type === 'UPDATE') {
          if (currentSection === 'SET') {
            currentOperation.setValues.push({ column: columnIndex, value: value });
          } else if (currentSection === 'WHERE') {
            currentOperation.whereConditions.push({ column: columnIndex, value: value });
          }
        } else {
          // INSERT 或 DELETE 操作
          currentOperation.values.push({ column: columnIndex, value: value });
        }
      }
    }
    
    // 不再更新已创建操作的时间戳，保持独立性
  }

  // 保存最后一个操作
  if (currentOperation) {
    const hasData = (currentOperation.type === 'UPDATE' && 
                    (currentOperation.setValues.length > 0 || currentOperation.whereConditions.length > 0)) ||
                   ((currentOperation.type === 'INSERT' || currentOperation.type === 'DELETE') && 
                    currentOperation.values.length > 0);
    
    if (hasData) {
      // 确保最后一个操作有时间戳
      if (!currentOperation.timestamp && currentTimestamp) {
        currentOperation.timestamp = currentTimestamp;
      }
      generateSQLStatements(currentOperation);
      operations.push(currentOperation);
    }
  }

  console.log(`解析完成，共找到 ${operations.length} 个操作`);
  
  // 发送解析完成消息
  if (progressSessionId) {
    sendProgress(progressSessionId, {
      type: 'parsed',
      stage: '解析完成',
      total: operations.length,
      message: `解析完成，共找到 ${operations.length} 个操作`
    });
  }
  
  return operations;
}

// 生成原始SQL和回滚SQL
function generateSQLStatements(operation) {
  const tableName = `\`${operation.database}\`.\`${operation.table}\``;
  
  switch (operation.type) {
    case 'INSERT':
      operation.originalSQL = generateInsertSQL(tableName, operation.values);
      operation.reverseSQL = generateDeleteSQL(tableName, operation.values);
      break;
    case 'UPDATE':
      operation.originalSQL = generateUpdateSQL(tableName, operation.setValues, operation.whereConditions);
      operation.reverseSQL = generateReverseUpdateSQL(tableName, operation.setValues, operation.whereConditions);
      break;
    case 'DELETE':
      operation.originalSQL = generateDeleteSQL(tableName, operation.values);
      operation.reverseSQL = generateInsertSQL(tableName, operation.values);
      break;
  }
}

// 生成INSERT SQL
function generateInsertSQL(tableName, values) {
  if (!values || values.length === 0) return '';
  
  const columns = values.map(v => `col_${v.column}`).join(', ');
  const vals = values.map(v => formatValue(v.value)).join(', ');
  
  return `INSERT INTO ${tableName} (${columns}) VALUES (${vals});`;
}

// 生成UPDATE SQL
function generateUpdateSQL(tableName, setValues, whereConditions) {
  if (!setValues || setValues.length === 0) return '';
  
  // 找出实际发生变化的字段
  const changedFields = [];
  const whereMap = new Map();
  
  // 创建WHERE条件的映射
  if (whereConditions) {
    whereConditions.forEach(w => {
      whereMap.set(w.column, w.value);
    });
  }
  
  // 只包含实际变化的字段
  setValues.forEach(s => {
    const oldValue = whereMap.get(s.column);
    if (oldValue !== s.value) {
      changedFields.push(s);
    }
  });
  
  // 如果没有变化的字段，使用所有SET字段
  const fieldsToUpdate = changedFields.length > 0 ? changedFields : setValues;
  
  const setPart = fieldsToUpdate.map(v => `col_${v.column} = ${formatValue(v.value)}`).join(', ');
  const wherePart = whereConditions && whereConditions.length > 0 
    ? whereConditions.map(w => `col_${w.column} = ${formatValue(w.value)}`).join(' AND ')
    : '1=1';
  
  return `UPDATE ${tableName} SET ${setPart} WHERE ${wherePart};`;
}

// 生成回滚UPDATE SQL
function generateReverseUpdateSQL(tableName, setValues, whereConditions) {
  if (!whereConditions || whereConditions.length === 0 || !setValues || setValues.length === 0) return '';
  
  // 找出实际发生变化的字段
  const changedFields = [];
  const whereMap = new Map();
  const setMap = new Map();
  
  // 创建映射
  whereConditions.forEach(w => {
    whereMap.set(w.column, w.value);
  });
  
  setValues.forEach(s => {
    setMap.set(s.column, s.value);
  });
  
  // 找出变化的字段，回滚时SET旧值
  setValues.forEach(s => {
    const oldValue = whereMap.get(s.column);
    if (oldValue !== s.value) {
      changedFields.push({ column: s.column, value: oldValue });
    }
  });
  
  // 如果没有找到变化的字段，使用WHERE条件作为SET
  const fieldsToRevert = changedFields.length > 0 ? changedFields : whereConditions;
  
  const setPart = fieldsToRevert.map(f => `col_${f.column} = ${formatValue(f.value)}`).join(', ');
  const wherePart = setValues.map(v => `col_${v.column} = ${formatValue(v.value)}`).join(' AND ');
  
  return `UPDATE ${tableName} SET ${setPart} WHERE ${wherePart};`;
}

// 生成DELETE SQL
function generateDeleteSQL(tableName, conditions) {
  if (!conditions || conditions.length === 0) return '';
  
  const wherePart = conditions.map(c => `col_${c.column} = ${formatValue(c.value)}`).join(' AND ');
  
  return `DELETE FROM ${tableName} WHERE ${wherePart};`;
}

// 格式化值
function formatValue(value) {
  if (value === null || value === 'NULL') {
    return 'NULL';
  }
  
  // 移除引号并重新添加适当的引号
  const cleanValue = value.toString().replace(/^['"]|['"]$/g, '');
  
  // 检查是否为数字
  if (/^\d+(\.\d+)?$/.test(cleanValue)) {
    return cleanValue;
  }
  
  // 字符串值需要转义单引号
  const escapedValue = cleanValue.replace(/'/g, "''");
  return `'${escapedValue}'`;
}

// 内存使用监控
function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(used.external / 1024 / 1024 * 100) / 100
  };
}

// 存储活跃的 SSE 连接
const activeConnections = new Map();

// SSE 进度推送端点
app.get('/progress/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // 存储连接
  activeConnections.set(sessionId, res);
  
  // 发送初始消息
  res.write('data: {"type":"connected","message":"连接已建立"}\n\n');
  
  // 处理连接关闭
  req.on('close', () => {
    activeConnections.delete(sessionId);
  });
});

// 发送进度更新
sendProgress = function(sessionId, data) {
  const connection = activeConnections.get(sessionId);
  if (connection) {
    try {
      connection.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('发送进度失败:', error);
      activeConnections.delete(sessionId);
    }
  }
};

// API路由
app.post('/upload', upload.single('binlogFile'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择binlog文件' });
    }

    filePath = req.file.path;
    console.log('解析binlog文件:', filePath);
    
    // 显示初始内存使用
    const initialMemory = getMemoryUsage();
    console.log('初始内存使用:', initialMemory);

    // 解析binlog
    // 使用前端传递的 progressSessionId，或生成新的
    const progressSessionId = req.body.progressSessionId || (Date.now().toString() + Math.random().toString(36).substr(2, 9));
    
    console.log('开始解析binlog...');
    const binlogOutput = await parseBinlog(filePath, progressSessionId);
    
    // 显示解析后内存使用
    const afterParseMemory = getMemoryUsage();
    console.log('解析后内存使用:', afterParseMemory);
    
    console.log('开始提取操作...');
    const operations = parseOperations(binlogOutput, progressSessionId);
    
    // 尝试保存到数据库（所有文件）
    let sessionId = null;
    const isDocker = fs.existsSync('/.dockerenv');
    
    // 存储到全局变量供内存查询使用
    global.currentOperations = operations;
    
    // Docker环境下大文件自动使用数据库存储（如果可用）
    const shouldUseDatabase = dbManager.useDatabase || (isDocker && operations.length > 100);
    
    if (shouldUseDatabase && operations.length > 0) {
      sessionId = dbManager.generateSessionId();
      const saved = await dbManager.saveOperations(sessionId, operations, progressSessionId);
      if (saved) {
        console.log(`数据已保存到数据库，会话 ID: ${sessionId}`);
      } else if (isDocker) {
        console.log('警告: Docker环境下建议使用数据库存储大文件');
      }
    }
    
    // 清理binlog输出以释放内存
    // binlogOutput = null; // 这行会导致错误，因为binlogOutput是const
    
    // 显示最终内存使用
    const finalMemory = getMemoryUsage();
    console.log('最终内存使用:', finalMemory);
    
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
      const afterGCMemory = getMemoryUsage();
      console.log('垃圾回收后内存使用:', afterGCMemory);
    }

    // 解析完成后立即清理文件
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('已清理临时文件:', filePath);
        filePath = null; // 标记已删除
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
      }
    }

    // 发送完成消息
    sendProgress(progressSessionId, {
      type: 'complete',
      message: '解析完成',
      total: operations.length,
      memoryUsage: finalMemory
    });
    
    // 延迟关闭 SSE 连接
    setTimeout(() => {
      const connection = activeConnections.get(progressSessionId);
      if (connection) {
        try {
          connection.end();
        } catch (error) {
          console.error('关闭 SSE 连接失败:', error);
        }
        activeConnections.delete(progressSessionId);
      }
    }, 2000);
    
    res.json({
      success: true,
      operations: operations.slice(0, 50), // 只返回前50条作为预览
      total: operations.length,
      sessionId: sessionId,
      useDatabase: !!sessionId,
      memoryUsage: finalMemory,
      hasMore: operations.length > 50,
      progressSessionId: progressSessionId,
      // 返回筛选选项
      filterOptions: {
        databases: Array.from(new Set(operations.map(op => op.database))).sort(),
        tables: Array.from(new Set(operations.map(op => `${op.database}.${op.table}`))).sort()
      }
    });

  } catch (error) {
    console.error('解析错误:', error);
    res.status(500).json({ 
      error: '解析binlog文件失败: ' + error.message 
    });
  } finally {
    // 确保清理上传的文件（如果还没有删除）
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('已清理临时文件:', filePath);
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
      }
    }
  }
});

// 分页查询 API
app.post('/operations/query', async (req, res) => {
  try {
    const {
      sessionId,
      page = 1,
      pageSize = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      filters = {}
    } = req.body;

    let operations = [];
    
    // 从数据库或内存获取数据
    if (sessionId && dbManager.useDatabase) {
      // 从数据库查询
      operations = await dbManager.getOperations(sessionId, {
        page,
        pageSize,
        sortBy,
        sortOrder,
        filters
      });
      
      if (!operations) {
        return res.status(500).json({ error: '从数据库获取数据失败' });
      }
    } else {
      // 从内存查询（需要先存储在全局变量中）
      if (!global.currentOperations) {
        return res.status(400).json({ error: '没有可用的操作数据' });
      }
      
      operations = filterAndSortOperations(global.currentOperations, {
        page,
        pageSize,
        sortBy,
        sortOrder,
        filters
      });
    }

    res.json({
      success: true,
      operations: operations.data || operations,
      total: operations.total || global.currentOperations?.length || 0,
      page,
      pageSize,
      totalPages: Math.ceil((operations.total || global.currentOperations?.length || 0) / pageSize)
    });
  } catch (error) {
    console.error('查询操作失败:', error);
    res.status(500).json({ error: '查询失败: ' + error.message });
  }
});

// 内存中的筛选和排序函数
function filterAndSortOperations(operations, options) {
  const { page, pageSize, sortBy, sortOrder, filters } = options;
  let filtered = [...operations];

  // 应用筛选
  if (filters.type) {
    filtered = filtered.filter(op => op.type === filters.type);
  }
  if (filters.database) {
    filtered = filtered.filter(op => op.database === filters.database);
  }
  if (filters.table) {
    filtered = filtered.filter(op => op.table === filters.table);
  }
  if (filters.startTime) {
    filtered = filtered.filter(op => {
      if (!op.timestamp) return false;
      return op.timestamp >= filters.startTime;
    });
  }
  if (filters.endTime) {
    filtered = filtered.filter(op => {
      if (!op.timestamp) return false;
      return op.timestamp <= filters.endTime;
    });
  }

  // 排序
  filtered.sort((a, b) => {
    let aVal, bVal;
    
    // 字段映射
    switch(sortBy) {
      case 'database_name':
        aVal = a.database;
        bVal = b.database;
        break;
      case 'table_name':
        aVal = a.table;
        bVal = b.table;
        break;
      case 'timestamp':
        aVal = new Date(a.timestamp || '1970-01-01');
        bVal = new Date(b.timestamp || '1970-01-01');
        break;
      default:
        aVal = a[sortBy];
        bVal = b[sortBy];
    }
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // 分页
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    data: filtered.slice(start, end),
    total: filtered.length
  };
}

// 获取时间范围
app.post('/time-range', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.json({ success: false, error: '缺少sessionId' });
    }
    
    // 如果使用数据库，从数据库查询
    if (dbManager && dbManager.useDatabase) {
      try {
        const [rows] = await dbManager.connection.execute(
          'SELECT MIN(timestamp) as minTime, MAX(timestamp) as maxTime FROM binlog_operations WHERE session_id = ? AND timestamp IS NOT NULL',
          [sessionId]
        );
        
        if (rows.length > 0 && rows[0].minTime && rows[0].maxTime) {
          return res.json({
            success: true,
            minTime: rows[0].minTime,
            maxTime: rows[0].maxTime
          });
        }
      } catch (dbError) {
        console.error('数据库查询时间范围失败:', dbError);
      }
    }
    
    // 如果数据库不可用，从内存中查找
    if (global.currentOperations) {
      const timestamps = global.currentOperations
        .map(op => op.timestamp)
        .filter(t => t && t !== 'N/A')
        .sort();
      
      if (timestamps.length > 0) {
        return res.json({
          success: true,
          minTime: timestamps[0],
          maxTime: timestamps[timestamps.length - 1]
        });
      }
    }
    
    res.json({ success: false, error: '未找到时间数据' });
  } catch (error) {
    console.error('获取时间范围失败:', error);
    res.json({ success: false, error: error.message });
  }
});

// 获取统计信息
app.post('/statistics', async (req, res) => {
  try {
    const { sessionId } = req.body;
    let operations = [];
    
    if (sessionId && dbManager.useDatabase) {
      // 从数据库获取统计
      const stats = await dbManager.getStatistics(sessionId);
      return res.json(stats);
    } else if (global.currentOperations) {
      operations = global.currentOperations;
    } else {
      return res.status(400).json({ error: '没有可用的操作数据' });
    }

    const stats = {
      total: operations.length,
      byType: {},
      byTable: {},
      byDatabase: {},
      timeline: {}
    };

    operations.forEach(op => {
      // 按类型统计
      stats.byType[op.type] = (stats.byType[op.type] || 0) + 1;
      
      // 按表统计
      const tableKey = `${op.database}.${op.table}`;
      stats.byTable[tableKey] = (stats.byTable[tableKey] || 0) + 1;
      
      // 按数据库统计
      stats.byDatabase[op.database] = (stats.byDatabase[op.database] || 0) + 1;
      
      // 时间线统计（按小时）
      if (op.timestamp) {
        const hour = op.timestamp.split(' ')[1].split(':')[0];
        stats.timeline[hour] = (stats.timeline[hour] || 0) + 1;
      }
    });

    res.json(stats);
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计信息失败: ' + error.message });
  }
});

// 获取筛选选项
app.post('/filter-options', async (req, res) => {
  try {
    const { sessionId } = req.body;
    let options = { databases: [], tables: [] };
    
    if (sessionId && dbManager && dbManager.useDatabase) {
      // 从数据库获取
      try {
        const [dbRows] = await dbManager.connection.execute(
          'SELECT DISTINCT database_name FROM binlog_operations WHERE session_id = ? ORDER BY database_name',
          [sessionId]
        );
        options.databases = dbRows.map(row => row.database_name);
        
        const [tableRows] = await dbManager.connection.execute(
          'SELECT DISTINCT table_name FROM binlog_operations WHERE session_id = ? ORDER BY table_name',
          [sessionId]
        );
        options.tables = tableRows.map(row => row.table_name);
      } catch (dbError) {
        console.error('数据库查询筛选选项失败:', dbError);
        // 降级到内存查询
        if (global.currentOperations) {
          const databases = new Set();
          const tables = new Set();
          
          global.currentOperations.forEach(op => {
            databases.add(op.database);
            tables.add(op.table);
          });
          
          options.databases = Array.from(databases).sort();
          options.tables = Array.from(tables).sort();
        }
      }
    } else if (global.currentOperations) {
      // 从内存获取
      const databases = new Set();
      const tables = new Set();
      
      global.currentOperations.forEach(op => {
        databases.add(op.database);
        tables.add(op.table);
      });
      
      options.databases = Array.from(databases).sort();
      options.tables = Array.from(tables).sort();
    }
    
    res.json(options);
  } catch (error) {
    console.error('获取筛选选项失败:', error);
    res.status(500).json({ error: '获取筛选选项失败: ' + error.message });
  }
});

// 获取本机IP地址
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // 跳过非IPv4和内部地址
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

// 启动服务器，自动寻找可用端口
async function startServer(port) {
  // 初始化数据库连接
  await dbManager.connect();
  
  const server = app.listen(port, '0.0.0.0', () => {
    const localIPs = getLocalIP();
    console.log(`🚀 MySQL Binlog 分析工具启动成功！`);
    console.log(`📍 本地访问: http://localhost:${port}`);
    
    if (localIPs.length > 0) {
      console.log(`🌐 局域网访问:`);
      localIPs.forEach(ip => {
        console.log(`   http://${ip}:${port}`);
      });
    }
    
    console.log(`📁 测试文件: test-data/test-binlog.log`);
    console.log(`💾 数据库支持: ${dbManager.useDatabase ? '已启用' : '未启用（使用内存存储）'}`);
    console.log(`⏹️  停止服务: Ctrl+C`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`端口 ${port} 已被占用，尝试端口 ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('服务器启动失败:', err);
      process.exit(1);
    }
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
}

startServer(PORT);