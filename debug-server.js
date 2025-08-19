// 简化的调试服务器
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ 
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  })
});

// 简化的解析函数
function parseOperations(binlogOutput) {
  const operations = [];
  const lines = binlogOutput.split('\n');
  let currentOperation = null;
  let currentTimestamp = null;
  let currentServerId = null;
  
  console.log('=== 调试解析过程 ===');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 解析时间戳
    if (line.startsWith('#') && line.includes('server id')) {
      let timestampMatch = line.match(/#(\d{6})\s+(\d{2}:\d{2}:\d{2})\s+server id\s+(\d+)/);
      
      if (timestampMatch) {
        const dateTimeStr = timestampMatch[1];
        const timeStr = timestampMatch[2];
        currentServerId = timestampMatch[3];
        
        // 格式: YYMMDD (如 241201)
        const year = '20' + dateTimeStr.substring(0, 2);
        const month = dateTimeStr.substring(2, 4);
        const day = dateTimeStr.substring(4, 6);
        currentTimestamp = `${year}-${month}-${day} ${timeStr}`;
        
        console.log(`时间戳解析: ${line} -> ${currentTimestamp}`);
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
        values: []
      };
      
      console.log(`创建操作: ${operationType} ${currentOperation.database}.${currentOperation.table} 时间: ${currentTimestamp}`);
    }

    // 解析列和值
    if (currentOperation && line.startsWith('###   @')) {
      const columnMatch = line.match(/###\s+@(\d+)=(.+)/);
      if (columnMatch) {
        currentOperation.values.push({ 
          column: parseInt(columnMatch[1]), 
          value: columnMatch[2] 
        });
      }
    }
  }

  if (currentOperation) {
    operations.push(currentOperation);
  }

  console.log(`=== 解析完成，共 ${operations.length} 个操作 ===`);
  operations.forEach((op, index) => {
    console.log(`${index + 1}. ${op.type} ${op.database}.${op.table} - ${op.timestamp}`);
  });

  return operations;
}

app.post('/upload', upload.single('binlogFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择binlog文件' });
    }

    const filePath = req.file.path;
    console.log('处理文件:', filePath);
    
    // 直接读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log('文件内容前500字符:', fileContent.substring(0, 500));
    
    // 解析操作
    const operations = parseOperations(fileContent);
    
    // 清理文件
    fs.unlinkSync(filePath);
    
    console.log('=== 返回给前端的数据 ===');
    console.log(JSON.stringify({
      success: true,
      operations: operations,
      total: operations.length
    }, null, 2));

    res.json({
      success: true,
      operations: operations,
      total: operations.length
    });

  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({ 
      error: '处理失败: ' + error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`调试服务器启动在端口 ${PORT}`);
  console.log(`访问: http://localhost:${PORT}`);
});