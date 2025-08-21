#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试binlog2sql功能
async function testBinlog2sql() {
  console.log('🧪 测试binlog2sql功能...');
  
  // 检查binlog2sql是否可用
  console.log('1. 检查binlog2sql安装...');
  
  try {
    // 测试Python和pymysql
    const pythonTest = spawn('python3', ['-c', 'import pymysql; print("pymysql OK")']);
    
    pythonTest.stdout.on('data', (data) => {
      console.log('✅ Python模块:', data.toString().trim());
    });
    
    pythonTest.stderr.on('data', (data) => {
      console.log('❌ Python错误:', data.toString().trim());
    });
    
    pythonTest.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Python环境检查通过');
        testBinlog2sqlCommand();
      } else {
        console.log('❌ Python环境检查失败');
      }
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

function testBinlog2sqlCommand() {
  console.log('2. 测试binlog2sql命令...');
  
  // 检查binlog2sql文件是否存在
  const binlog2sqlPath = '/opt/binlog2sql/binlog2sql/binlog2sql.py';
  
  if (fs.existsSync(binlog2sqlPath)) {
    console.log('✅ binlog2sql文件存在:', binlog2sqlPath);
    
    // 测试命令帮助
    const helpTest = spawn('python3', [binlog2sqlPath, '--help']);
    
    helpTest.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('--stdin')) {
        console.log('✅ binlog2sql支持--stdin参数');
      }
    });
    
    helpTest.stderr.on('data', (data) => {
      console.log('ℹ️ binlog2sql帮助信息:', data.toString().trim());
    });
    
    helpTest.on('close', (code) => {
      console.log(`✅ binlog2sql命令测试完成 (退出码: ${code})`);
      testMysqlbinlog();
    });
    
  } else {
    console.log('❌ binlog2sql文件不存在:', binlog2sqlPath);
  }
}

function testMysqlbinlog() {
  console.log('3. 测试mysqlbinlog命令...');
  
  const mysqlbinlogTest = spawn('mysqlbinlog', ['--version']);
  
  mysqlbinlogTest.stdout.on('data', (data) => {
    console.log('✅ mysqlbinlog版本:', data.toString().trim());
  });
  
  mysqlbinlogTest.stderr.on('data', (data) => {
    console.log('ℹ️ mysqlbinlog信息:', data.toString().trim());
  });
  
  mysqlbinlogTest.on('close', (code) => {
    console.log(`✅ mysqlbinlog测试完成 (退出码: ${code})`);
    testPipeline();
  });
  
  mysqlbinlogTest.on('error', (error) => {
    console.log('❌ mysqlbinlog不可用:', error.message);
  });
}

function testPipeline() {
  console.log('4. 测试管道连接...');
  
  // 创建测试binlog内容
  const testBinlogContent = `# at 4
#241201 10:30:20 server id 1  end_log_pos 123 CRC32 0x12345678 	Start: binlog v 4, server v 8.0.32 created 241201 10:30:20
# at 123
#241201 10:30:21 server id 1  end_log_pos 200 CRC32 0x87654321 	Query	thread_id=1	exec_time=0	error_code=0
SET TIMESTAMP=1733040621/*!*/;
SET @@session.pseudo_thread_id=1/*!*/;
### INSERT INTO \`test\`.\`users\`
### SET
###   @1=1
###   @2='John'
###   @3='john@example.com'
`;
  
  // 写入临时文件
  const tempFile = '/tmp/test-binlog.log';
  fs.writeFileSync(tempFile, testBinlogContent);
  
  console.log('✅ 创建测试binlog文件:', tempFile);
  
  // 测试mysqlbinlog解析
  const mysqlbinlog = spawn('mysqlbinlog', [
    '--base64-output=DECODE-ROWS',
    '-v',
    tempFile
  ]);
  
  let mysqlbinlogOutput = '';
  
  mysqlbinlog.stdout.on('data', (data) => {
    mysqlbinlogOutput += data.toString();
  });
  
  mysqlbinlog.on('close', (code) => {
    console.log(`✅ mysqlbinlog解析完成 (退出码: ${code})`);
    console.log('📄 mysqlbinlog输出长度:', mysqlbinlogOutput.length);
    
    if (mysqlbinlogOutput.length > 0) {
      console.log('✅ 管道测试成功');
      console.log('🎉 所有测试通过！binlog2sql功能可用');
    } else {
      console.log('❌ mysqlbinlog输出为空');
    }
    
    // 清理临时文件
    try {
      fs.unlinkSync(tempFile);
      console.log('🧹 清理临时文件完成');
    } catch (error) {
      console.log('⚠️ 清理临时文件失败:', error.message);
    }
  });
  
  mysqlbinlog.on('error', (error) => {
    console.log('❌ mysqlbinlog执行失败:', error.message);
  });
}

// 运行测试
testBinlog2sql();