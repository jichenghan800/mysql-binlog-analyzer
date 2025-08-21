#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

// 调试binlog解析问题
async function debugBinlog() {
  console.log('🔍 调试binlog解析问题');
  console.log('=====================================\n');
  
  const filePath = './public/mysql-bin.029261';
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ binlog文件不存在:', filePath);
    return;
  }
  
  console.log('✅ 找到binlog文件:', filePath);
  
  // 解析binlog
  return new Promise((resolve, reject) => {
    const mysqlbinlog = spawn('mysqlbinlog', [
      '--base64-output=DECODE-ROWS',
      '--disable-log-bin',
      '-v',
      filePath
    ]);
    
    let output = '';
    let lineCount = 0;
    
    mysqlbinlog.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mysqlbinlog.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mysqlbinlog失败: ${code}`));
        return;
      }
      
      console.log('✅ mysqlbinlog解析成功');
      
      // 分析输出
      const lines = output.split('\n');
      console.log(`📄 总行数: ${lines.length}`);
      
      // 查找server_id
      const serverIdLines = lines.filter(line => line.includes('server id'));
      console.log(`🔍 找到 ${serverIdLines.length} 行包含server id`);
      
      if (serverIdLines.length > 0) {
        console.log('\n📋 Server ID 样本:');
        serverIdLines.slice(0, 3).forEach((line, i) => {
          console.log(`  ${i + 1}: ${line.trim()}`);
          
          // 解析server_id
          const match = line.match(/server id\s+(\d+)/);
          if (match) {
            const serverId = match[1];
            console.log(`     -> Server ID: ${serverId} (长度: ${serverId.length})`);
            console.log(`     -> 数值: ${parseInt(serverId)}`);
            console.log(`     -> INT最大值: ${2147483647}`);
            console.log(`     -> 是否超出INT: ${parseInt(serverId) > 2147483647 ? '是' : '否'}`);
          }
        });
      }
      
      // 查找操作
      const operationLines = lines.filter(line => 
        line.includes('### UPDATE') || 
        line.includes('### INSERT') || 
        line.includes('### DELETE')
      );
      console.log(`\n🔧 找到 ${operationLines.length} 个操作`);
      
      if (operationLines.length > 0) {
        console.log('\n📋 操作样本:');
        operationLines.slice(0, 3).forEach((line, i) => {
          console.log(`  ${i + 1}: ${line.trim()}`);
        });
      }
      
      // 查找值行
      const valueLines = lines.filter(line => line.startsWith('###   @'));
      console.log(`\n💾 找到 ${valueLines.length} 个值行`);
      
      if (valueLines.length > 0) {
        console.log('\n📋 值样本:');
        valueLines.slice(0, 10).forEach((line, i) => {
          console.log(`  ${i + 1}: ${line.trim()}`);
          
          // 测试解析
          const match = line.match(/###\s+@(\d+)=(.+)/);
          if (match) {
            const columnIndex = parseInt(match[1]);
            let rawValue = match[2];
            
            console.log(`     -> 列${columnIndex}: 原始值="${rawValue}"`);
            
            // 应用我们的解析逻辑
            let parsedValue = rawValue;
            
            if (rawValue === 'NULL') {
              parsedValue = null;
            } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
              parsedValue = rawValue.slice(1, -1).replace(/\\'/g, "'");
            } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
              parsedValue = rawValue;
            } else {
              let cleanValue = rawValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
              if (cleanValue.startsWith('NULL') && cleanValue.length > 4) {
                parsedValue = null;
              } else {
                parsedValue = cleanValue.trim();
              }
            }
            
            console.log(`     -> 解析后: ${JSON.stringify(parsedValue)}`);
          }
        });
      }
      
      resolve();
    });
    
    mysqlbinlog.on('error', (err) => {
      reject(err);
    });
  });
}

// 运行调试
debugBinlog().catch(console.error);