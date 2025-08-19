// 测试时间戳解析逻辑
const fs = require('fs');

// 模拟解析函数
function parseOperations(binlogOutput) {
  const operations = [];
  const lines = binlogOutput.split('\n');
  let currentOperation = null;
  let currentTimestamp = null;
  let currentServerId = null;
  let currentSection = null;
  
  console.log('开始解析时间戳...');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 解析时间戳 - 支持多种格式
    if (line.startsWith('#') && line.includes('server id')) {
      // 匹配各种可能的时间戳格式
      let timestampMatch = line.match(/#(\d+)\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      
      if (!timestampMatch) {
        // 尝试匹配带日期的格式: #241201 10:30:20 server id 1
        timestampMatch = line.match(/#(\d{6})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (!timestampMatch) {
        // 尝试匹配完整日期格式: #2024-12-01 10:30:20 server id 1
        timestampMatch = line.match(/#(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      }
      
      if (timestampMatch) {
        const dateTimeStr = timestampMatch[1];
        const timeStr = timestampMatch[2];
        currentServerId = timestampMatch[3];
        
        console.log(`调试时间戳解析: 原始="${dateTimeStr}", 时间="${timeStr}"`);
        
        // 处理不同的时间格式
        if (dateTimeStr.length === 6) {
          // 格式: YYMMDD (如 241201)
          const year = '20' + dateTimeStr.substring(0, 2);
          const month = dateTimeStr.substring(2, 4);
          const day = dateTimeStr.substring(4, 6);
          currentTimestamp = `${year}-${month}-${day} ${timeStr}`;
          console.log(`解析为YYMMDD格式: ${currentTimestamp}`);
        } else if (dateTimeStr.length === 10 && !dateTimeStr.includes('-')) {
          // Unix时间戳
          const unixTimestamp = parseInt(dateTimeStr);
          if (unixTimestamp > 1000000000) { // 合理的Unix时间戳
            const date = new Date(unixTimestamp * 1000);
            currentTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`解析为Unix时间戳: ${unixTimestamp} -> ${currentTimestamp}`);
          } else {
            currentTimestamp = `${dateTimeStr} ${timeStr}`;
            console.log(`无效Unix时间戳，使用原始: ${currentTimestamp}`);
          }
        } else if (dateTimeStr.includes('-')) {
          // 已经是标准日期格式
          currentTimestamp = `${dateTimeStr} ${timeStr}`;
          console.log(`标准日期格式: ${currentTimestamp}`);
        } else {
          // 其他格式，尝试直接解析
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
      
      // 为每个操作创建独立的时间戳副本
      currentOperation = {
        type: operationType,
        database: tableMatch ? tableMatch[2] : 'unknown',
        table: tableMatch ? tableMatch[3] : 'unknown',
        timestamp: currentTimestamp, // 使用当前最新的时间戳
        serverId: currentServerId,
        setValues: [],
        whereConditions: [],
        values: [],
        originalSQL: '',
        reverseSQL: ''
      };
      
      console.log(`创建新操作: ${operationType} ${currentOperation.database}.${currentOperation.table} 时间戳: ${currentTimestamp}`);
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
    
    // 如果当前操作存在但还没有时间戳，尝试使用最新的时间戳
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

// 读取测试文件并解析
const testFile = '/home/han/mcp/mysql-binlog-analyzer/uploads/1755493899069-test-binlog.log';
if (fs.existsSync(testFile)) {
  const fileContent = fs.readFileSync(testFile, 'utf8');
  const operations = parseOperations(fileContent);
  
  console.log('\n=== 解析结果 ===');
  operations.forEach((op, index) => {
    console.log(`${index + 1}. ${op.type} ${op.database}.${op.table} - 时间戳: ${op.timestamp}`);
  });
} else {
  console.log('测试文件不存在');
}