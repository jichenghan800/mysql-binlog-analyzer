#!/usr/bin/env node

const { spawn } = require('child_process');

// 精确解析测试
async function testPreciseParsing() {
  console.log('🔍 精确解析测试');
  console.log('=====================================\n');
  
  const filePath = './public/mysql-bin.029261';
  
  return new Promise((resolve, reject) => {
    const mysqlbinlog = spawn('mysqlbinlog', [
      '--base64-output=DECODE-ROWS',
      '--disable-log-bin',
      '-v',
      filePath
    ]);
    
    let output = '';
    
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
      
      // 查找值行并分析
      const valueLines = lines.filter(line => line.match(/^###\s+@\d+=.+/));
      console.log(`💾 找到 ${valueLines.length} 个值行`);
      
      console.log('\n🔍 分析值行格式:');
      
      // 分类分析
      const nullValues = valueLines.filter(line => line.includes('=NULL'));
      const stringValues = valueLines.filter(line => line.includes("='"));
      const numberValues = valueLines.filter(line => line.match(/=\d+(\.\d+)?$/));
      
      console.log(`NULL值: ${nullValues.length} 个`);
      console.log(`字符串值: ${stringValues.length} 个`);
      console.log(`数字值: ${numberValues.length} 个`);
      
      // 检查问题值
      console.log('\n🚨 检查问题值:');
      const problemValues = valueLines.filter(line => {
        const match = line.match(/^###\s+@\d+=(.+)/);
        if (!match) return false;
        
        const value = match[1];
        // 检查是否是NULL后跟数字的情况
        return /^NULL\d+/.test(value);
      });
      
      console.log(`发现 ${problemValues.length} 个问题值:`);
      problemValues.forEach((line, i) => {
        console.log(`  ${i + 1}: ${line.trim()}`);
      });
      
      // 精确解析函数
      function parseValuePrecise(line) {
        const match = line.match(/^###\s+@(\d+)=(.+)$/);
        if (!match) return null;
        
        const columnIndex = parseInt(match[1]);
        const rawValue = match[2];
        
        console.log(`\n解析: 列${columnIndex} = "${rawValue}"`);
        
        let value;
        
        // 严格按照mysqlbinlog输出格式解析
        if (rawValue === 'NULL') {
          value = null;
          console.log(`  -> NULL值`);
        } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
          value = rawValue.slice(1, -1);
          // 处理转义
          value = value.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
          console.log(`  -> 字符串: "${value}"`);
        } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
          value = rawValue;
          console.log(`  -> 数字: ${value}`);
        } else {
          // 这里不应该有其他情况，如果有就是解析错误
          console.log(`  -> ⚠️ 未知格式: "${rawValue}"`);
          
          // 尝试修复
          if (rawValue.startsWith('NULL') && rawValue.length > 4) {
            console.log(`  -> 修复为NULL`);
            value = null;
          } else {
            value = rawValue;
          }
        }
        
        return { column: columnIndex, value: value };
      }
      
      // 测试前几个值行
      console.log('\n📋 测试解析前10个值行:');
      valueLines.slice(0, 10).forEach((line, i) => {
        const result = parseValuePrecise(line);
        if (result) {
          console.log(`${i + 1}. col_${result.column} = ${JSON.stringify(result.value)}`);
        }
      });
      
      // 专门测试问题值
      if (problemValues.length > 0) {
        console.log('\n🔧 测试问题值解析:');
        problemValues.forEach((line, i) => {
          const result = parseValuePrecise(line);
          if (result) {
            console.log(`问题${i + 1}. col_${result.column} = ${JSON.stringify(result.value)}`);
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

testPreciseParsing().catch(console.error);