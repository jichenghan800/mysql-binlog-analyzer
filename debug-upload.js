// 调试上传和解析过程
const fs = require('fs');
const path = require('path');

// 导入server.js中的函数
const { spawn } = require('child_process');

// 检查文件是否是测试格式
function isTestFormat(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const readSize = Math.min(4096, stats.size);
    
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, readSize, 0);
    fs.closeSync(fd);
    
    const sample = buffer.slice(0, bytesRead).toString('utf8');
    
    const hasTestMarkers = sample.includes('### INSERT INTO') || 
                          sample.includes('### UPDATE') || 
                          sample.includes('### DELETE FROM') ||
                          sample.includes('BINLOG') ||
                          sample.includes('/*!50530 SET @@SESSION.PSEUDO_SLAVE_MODE=1*/');
    
    const isBinary = buffer.some(byte => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13);
    
    return hasTestMarkers && !isBinary;
  } catch (error) {
    console.error('检查文件格式失败:', error);
    return false;
  }
}

// 解析binlog文件
function parseBinlog(filePath) {
  return new Promise((resolve, reject) => {
    const stats = fs.statSync(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`文件大小: ${fileSizeInMB.toFixed(2)} MB`);
    
    if (isTestFormat(filePath)) {
      console.log('检测到测试格式的binlog文件，直接解析...');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      resolve(fileContent);
      return;
    }
    
    console.log('检测到二进制binlog文件，使用mysqlbinlog工具解析...');
    
    const mysqlbinlog = spawn('mysqlbinlog', [
      '-v', 
      '--base64-output=DECODE-ROWS',
      '--start-datetime=1970-01-01 00:00:00',
      filePath
    ]);
    let output = '';
    let error = '';

    mysqlbinlog.stdout.on('data', (data) => {
      output += data.toString();
    });

    mysqlbinlog.stderr.on('data', (data) => {
      error += data.toString();
    });

    mysqlbinlog.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mysqlbinlog进程退出，代码: ${code}, 错误: ${error}`));
      } else {
        resolve(output);
      }
    });

    mysqlbinlog.on('error', (err) => {
      reject(new Error(`mysqlbinlog执行失败: ${err.message}`));
    });
  });
}

// 解析SQL操作
function parseOperations(binlogOutput) {
  const operations = [];
  const lines = binlogOutput.split('\n');
  let currentOperation = null;
  let currentTimestamp = null;
  let currentServerId = null;
  let currentSection = null;
  
  console.log(`开始解析 ${lines.length} 行binlog输出...`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 解析时间戳
    if (line.startsWith('#') && line.includes('server id')) {
      let timestampMatch = line.match(/#(\d+)\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      
      if (!timestampMatch) {
        timestampMatch = line.match(/#(\d{6})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (!timestampMatch) {
        timestampMatch = line.match(/#(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (timestampMatch) {
        const dateTimeStr = timestampMatch[1];
        const timeStr = timestampMatch[2];
        currentServerId = timestampMatch[3];
        
        console.log(`调试时间戳解析: 原始="${dateTimeStr}", 时间="${timeStr}"`);
        
        if (dateTimeStr.length === 6) {
          const year = '20' + dateTimeStr.substring(0, 2);
          const month = dateTimeStr.substring(2, 4);
          const day = dateTimeStr.substring(4, 6);
          currentTimestamp = `${year}-${month}-${day} ${timeStr}`;
          console.log(`解析为YYMMDD格式: ${currentTimestamp}`);
        } else if (dateTimeStr.length === 10 && !dateTimeStr.includes('-')) {
          const unixTimestamp = parseInt(dateTimeStr);
          if (unixTimestamp > 1000000000) {
            const date = new Date(unixTimestamp * 1000);
            currentTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`解析为Unix时间戳: ${unixTimestamp} -> ${currentTimestamp}`);
          } else {
            currentTimestamp = `${dateTimeStr} ${timeStr}`;
            console.log(`无效Unix时间戳，使用原始: ${currentTimestamp}`);
          }
        } else if (dateTimeStr.includes('-')) {
          currentTimestamp = `${dateTimeStr} ${timeStr}`;
          console.log(`标准日期格式: ${currentTimestamp}`);
        } else {
          currentTimestamp = `${dateTimeStr} ${timeStr}`;
          console.log(`其他格式: ${currentTimestamp}`);
        }
      }
    }

    // 检测操作类型
    if (line.includes('### INSERT INTO') || line.includes('### UPDATE') || line.includes('### DELETE FROM')) {
      if (currentOperation) {
        operations.push(currentOperation);
      }

      currentSection = null;
      const operationType = line.includes('INSERT') ? 'INSERT' : 
                           line.includes('UPDATE') ? 'UPDATE' : 'DELETE';
      const tableMatch = line.match(/###\s+(INSERT INTO|UPDATE|DELETE FROM)\s+`?([^`\s]+)`?\.`?([^`\s]+)`?/);
      
      currentOperation = {
        type: operationType,
        database: tableMatch ? tableMatch[2] : 'unknown',
        table: tableMatch ? tableMatch[3] : 'unknown',
        timestamp: currentTimestamp,
        serverId: currentServerId,
        setValues: [],
        whereConditions: [],
        values: [],
        originalSQL: '',
        reverseSQL: ''
      };
      
      console.log(`创建新操作: ${operationType} ${currentOperation.database}.${currentOperation.table} 时间戳: ${currentTimestamp}`);
    }

    // 检测SET部分
    if (line.includes('### SET')) {
      currentSection = 'SET';
      continue;
    }

    // 检测WHERE部分
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
          currentOperation.values.push({ column: columnIndex, value: value });
        }
      }
    }
    
    if (currentOperation && !currentOperation.timestamp && currentTimestamp) {
      currentOperation.timestamp = currentTimestamp;
      console.log(`为操作 ${currentOperation.type} ${currentOperation.database}.${currentOperation.table} 更新时间戳: ${currentTimestamp}`);
    }
  }

  if (currentOperation) {
    operations.push(currentOperation);
  }

  console.log(`解析完成，共找到 ${operations.length} 个操作`);
  return operations;
}

// 测试解析
async function testParse() {
  const testFile = '/home/han/mcp/mysql-binlog-analyzer/test-data/test-binlog.log';
  
  if (!fs.existsSync(testFile)) {
    console.log('测试文件不存在，创建一个...');
    return;
  }
  
  try {
    console.log('开始解析测试文件...');
    const binlogOutput = await parseBinlog(testFile);
    const operations = parseOperations(binlogOutput);
    
    console.log('\n=== 最终结果 ===');
    operations.forEach((op, index) => {
      console.log(`${index + 1}. ${op.type} ${op.database}.${op.table}`);
      console.log(`   时间戳: ${op.timestamp}`);
      console.log(`   服务器ID: ${op.serverId}`);
      console.log('');
    });
    
    // 输出JSON格式，模拟API响应
    console.log('\n=== JSON响应 ===');
    console.log(JSON.stringify({
      success: true,
      operations: operations,
      total: operations.length
    }, null, 2));
    
  } catch (error) {
    console.error('解析失败:', error);
  }
}

testParse();