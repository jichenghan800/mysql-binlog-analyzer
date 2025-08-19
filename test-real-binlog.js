// 测试真实binlog文件的解析
const { spawn } = require('child_process');
const fs = require('fs');

// 解析binlog文件
function parseBinlog(filePath) {
  return new Promise((resolve, reject) => {
    console.log('使用mysqlbinlog解析真实binlog文件...');
    
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
  
  // 显示前20行来调试
  console.log('\n=== Binlog输出前20行 ===');
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i].trim()) {
      console.log(`${i}: ${lines[i].trim()}`);
    }
  }
  console.log('=== 开始解析 ===\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 解析时间戳 - 支持多种格式
    if (line.startsWith('#') && line.includes('server id')) {
      let timestampMatch = null;
      
      // 格式1: #250818  5:44:35 server id 3051036106 (YYMMDD HH:MM:SS)
      timestampMatch = line.match(/#(\d{6})\s+(\d{1,2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      
      if (!timestampMatch) {
        // 格式2: #2025-08-18 05:44:35 server id 3051036106 (YYYY-MM-DD HH:MM:SS)
        timestampMatch = line.match(/#(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (!timestampMatch) {
        // 格式3: #1755467075 server id 3051036106 (Unix时间戳)
        timestampMatch = line.match(/#(\d{10})\s+server id\s+(\d+)/);
        if (timestampMatch) {
          timestampMatch = [timestampMatch[0], timestampMatch[1], '00:00:00', timestampMatch[2]];
        }
      }
      
      if (timestampMatch) {
        const dateTimeStr = timestampMatch[1];
        const timeStr = timestampMatch[2];
        currentServerId = timestampMatch[3];
        
        console.log(`时间戳解析: 行="${line}"`);
        console.log(`  -> 原始="${dateTimeStr}", 时间="${timeStr}", 服务器ID="${currentServerId}"`);
        
        // 处理不同的时间格式
        if (dateTimeStr.length === 6 && /^\d{6}$/.test(dateTimeStr)) {
          // 格式: YYMMDD (如 250818)
          const year = '20' + dateTimeStr.substring(0, 2);
          const month = dateTimeStr.substring(2, 4);
          const day = dateTimeStr.substring(4, 6);
          currentTimestamp = `${year}-${month}-${day} ${timeStr}`;
          console.log(`  -> 解析为YYMMDD格式: ${currentTimestamp}`);
        } else if (dateTimeStr.length === 10 && /^\d{10}$/.test(dateTimeStr)) {
          // Unix时间戳 (10位数字)
          const unixTimestamp = parseInt(dateTimeStr);
          if (unixTimestamp > 946684800) { // 2000年1月1日的时间戳
            const date = new Date(unixTimestamp * 1000);
            if (timeStr && timeStr !== '00:00:00') {
              const dateStr = date.toISOString().slice(0, 10);
              currentTimestamp = `${dateStr} ${timeStr}`;
            } else {
              currentTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');
            }
            console.log(`  -> 解析为Unix时间戳: ${unixTimestamp} -> ${currentTimestamp}`);
          } else {
            currentTimestamp = `${dateTimeStr} ${timeStr}`;
            console.log(`  -> 无效Unix时间戳，使用原始: ${currentTimestamp}`);
          }
        } else if (dateTimeStr.includes('-')) {
          // 已经是标准日期格式 YYYY-MM-DD
          currentTimestamp = `${dateTimeStr} ${timeStr}`;
          console.log(`  -> 标准日期格式: ${currentTimestamp}`);
        } else {
          // 其他格式，尝试直接解析
          currentTimestamp = `${dateTimeStr} ${timeStr}`;
          console.log(`  -> 其他格式，直接使用: ${currentTimestamp}`);
        }
      }
    }

    // 从SET TIMESTAMP语句中解析时间戳
    if (line.includes('SET TIMESTAMP=')) {
      const timestampMatch = line.match(/SET TIMESTAMP=(\d+)/);
      if (timestampMatch) {
        const unixTimestamp = parseInt(timestampMatch[1]);
        if (unixTimestamp > 946684800) { // 2000年1月1日后
          const date = new Date(unixTimestamp * 1000);
          const newTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');
          console.log(`从SET TIMESTAMP解析: ${unixTimestamp} -> ${newTimestamp}`);
          // 只有在没有当前时间戳或新时间戳更合理时才更新
          if (!currentTimestamp || (currentTimestamp.includes('1970') && !newTimestamp.includes('1970'))) {
            currentTimestamp = newTimestamp;
            console.log(`  -> 更新当前时间戳为: ${currentTimestamp}`);
          }
        }
      }
    }

    // 检测操作类型
    if (line.includes('### UPDATE') || line.includes('### INSERT') || line.includes('### DELETE')) {
      if (currentOperation) {
        operations.push(currentOperation);
      }

      let operationType = 'UNKNOWN';
      let database = 'unknown';
      let table = 'unknown';
      
      if (line.includes('### UPDATE')) {
        operationType = 'UPDATE';
        const tableMatch = line.match(/### UPDATE `?([^`\s]+)`?\.`?([^`\s]+)`?/);
        if (tableMatch) {
          database = tableMatch[1];
          table = tableMatch[2];
        }
      } else if (line.includes('### INSERT')) {
        operationType = 'INSERT';
        const tableMatch = line.match(/### INSERT INTO `?([^`\s]+)`?\.`?([^`\s]+)`?/);
        if (tableMatch) {
          database = tableMatch[1];
          table = tableMatch[2];
        }
      } else if (line.includes('### DELETE')) {
        operationType = 'DELETE';
        const tableMatch = line.match(/### DELETE FROM `?([^`\s]+)`?\.`?([^`\s]+)`?/);
        if (tableMatch) {
          database = tableMatch[1];
          table = tableMatch[2];
        }
      }
      
      currentOperation = {
        type: operationType,
        database: database,
        table: table,
        timestamp: currentTimestamp,
        serverId: currentServerId,
        setValues: [],
        whereConditions: [],
        values: []
      };
      
      console.log(`创建操作: ${operationType} ${database}.${table} 时间: ${currentTimestamp}`);
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
    
    // 如果当前操作存在但还没有时间戳，尝试使用最新的时间戳
    if (currentOperation && !currentOperation.timestamp && currentTimestamp) {
      currentOperation.timestamp = currentTimestamp;
      console.log(`为操作 ${currentOperation.type} ${currentOperation.database}.${currentOperation.table} 更新时间戳: ${currentTimestamp}`);
    }
  }

  if (currentOperation) {
    operations.push(currentOperation);
  }

  console.log(`\n解析完成，共找到 ${operations.length} 个操作`);
  return operations;
}

// 测试真实binlog文件
async function testRealBinlog() {
  const binlogFile = '/home/han/mcp/mysql-binlog-analyzer/mysql-bin.029261';
  
  try {
    console.log('=== 测试真实binlog文件 ===');
    
    // 1. 解析binlog
    const binlogOutput = await parseBinlog(binlogFile);
    console.log('1. Binlog解析完成');
    
    // 2. 解析操作
    const operations = parseOperations(binlogOutput);
    console.log('2. 操作解析完成');
    
    // 3. 显示结果
    console.log('\n=== 解析结果 ===');
    operations.forEach((op, index) => {
      console.log(`${index + 1}. ${op.type} ${op.database}.${op.table}`);
      console.log(`   时间戳: ${op.timestamp}`);
      console.log(`   服务器ID: ${op.serverId}`);
      
      // 检查时间戳是否为1970年
      if (op.timestamp && op.timestamp.includes('1970')) {
        console.log(`   ❌ 时间戳显示为1970年！`);
      } else if (op.timestamp) {
        console.log(`   ✅ 时间戳正常`);
      } else {
        console.log(`   ⚠️  没有时间戳`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testRealBinlog();