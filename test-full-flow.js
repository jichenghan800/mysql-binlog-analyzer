// 测试完整流程
const fs = require('fs');

// 模拟后端解析
function parseOperations(binlogOutput) {
  const operations = [];
  const lines = binlogOutput.split('\n');
  let currentOperation = null;
  let currentTimestamp = null;
  let currentServerId = null;
  let currentSection = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 解析时间戳
    if (line.startsWith('#') && line.includes('server id')) {
      let timestampMatch = line.match(/#(\d{6})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      
      if (timestampMatch) {
        const dateTimeStr = timestampMatch[1];
        const timeStr = timestampMatch[2];
        currentServerId = timestampMatch[3];
        
        const year = '20' + dateTimeStr.substring(0, 2);
        const month = dateTimeStr.substring(2, 4);
        const day = dateTimeStr.substring(4, 6);
        currentTimestamp = `${year}-${month}-${day} ${timeStr}`;
      }
    }

    // 检测操作类型
    if (line.includes('### INSERT INTO') || line.includes('### UPDATE') || line.includes('### DELETE FROM')) {
      if (currentOperation) {
        operations.push(currentOperation);
      }

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
        values: []
      };
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
  }

  if (currentOperation) {
    operations.push(currentOperation);
  }

  return operations;
}

// 模拟前端解析时间戳
function parseTimestamp(timestamp) {
  if (!timestamp || timestamp === 'N/A' || timestamp === 'null' || timestamp === 'undefined') {
    return null;
  }
  
  try {
    const cleanTimestamp = timestamp.toString().trim();
    
    if (!cleanTimestamp || cleanTimestamp === 'N/A') {
      return null;
    }
    
    if (cleanTimestamp.includes('T')) {
      return new Date(cleanTimestamp);
    } else if (cleanTimestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      return new Date(cleanTimestamp);
    } else if (cleanTimestamp.match(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const parts = cleanTimestamp.split(' ');
      const dateParts = parts[0].split('-');
      const year = '20' + dateParts[0];
      const formattedDate = `${year}-${dateParts[1]}-${dateParts[2]} ${parts[1]}`;
      return new Date(formattedDate);
    } else if (cleanTimestamp.match(/^\d+$/)) {
      const unixTimestamp = parseInt(cleanTimestamp);
      if (unixTimestamp > 0 && unixTimestamp < 9999999999) {
        return new Date(unixTimestamp * 1000);
      } else if (unixTimestamp > 9999999999) {
        return new Date(unixTimestamp);
      }
      return null;
    } else {
      const date = new Date(cleanTimestamp);
      if (isNaN(date.getTime()) || date.getFullYear() < 1990) {
        return null;
      }
      return date;
    }
  } catch (error) {
    console.warn('无法解析时间戳:', timestamp, error);
    return null;
  }
}

function formatDateTime(date) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp || timestamp === 'N/A') {
    return 'N/A';
  }
  
  const date = parseTimestamp(timestamp);
  if (!date) {
    return timestamp;
  }
  
  return formatDateTime(date);
}

// 测试完整流程
async function testFullFlow() {
  const testFile = '/home/han/mcp/mysql-binlog-analyzer/test-data/test-binlog.log';
  
  if (!fs.existsSync(testFile)) {
    console.log('测试文件不存在');
    return;
  }
  
  console.log('=== 测试完整流程 ===');
  
  // 1. 读取文件（模拟上传）
  const fileContent = fs.readFileSync(testFile, 'utf8');
  console.log('1. 文件读取成功');
  
  // 2. 后端解析
  const operations = parseOperations(fileContent);
  console.log('2. 后端解析完成，操作数量:', operations.length);
  
  // 3. 模拟API响应
  const apiResponse = {
    success: true,
    operations: operations,
    total: operations.length
  };
  
  console.log('3. API响应数据:');
  console.log(JSON.stringify(apiResponse, null, 2));
  
  // 4. 模拟前端处理
  console.log('\n4. 前端处理结果:');
  apiResponse.operations.forEach((op, index) => {
    console.log(`${index + 1}. ${op.type} ${op.database}.${op.table}`);
    console.log(`   后端时间戳: ${op.timestamp}`);
    console.log(`   前端解析: ${parseTimestamp(op.timestamp)}`);
    console.log(`   前端显示: ${formatTimestamp(op.timestamp)}`);
    console.log('');
  });
  
  // 5. 检查时间戳是否为1970年
  console.log('5. 时间戳检查:');
  apiResponse.operations.forEach((op, index) => {
    const parsed = parseTimestamp(op.timestamp);
    if (parsed && parsed.getFullYear() === 1970) {
      console.log(`❌ 操作 ${index + 1} 时间戳显示为1970年: ${op.timestamp} -> ${formatTimestamp(op.timestamp)}`);
    } else if (parsed) {
      console.log(`✅ 操作 ${index + 1} 时间戳正常: ${op.timestamp} -> ${formatTimestamp(op.timestamp)}`);
    } else {
      console.log(`⚠️  操作 ${index + 1} 时间戳解析失败: ${op.timestamp}`);
    }
  });
}

testFullFlow();