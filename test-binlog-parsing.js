#!/usr/bin/env node

/**
 * 测试脚本：验证 mysqlbinlog 参数修改的效果
 * 用于测试 --base64-output=DECODE-ROWS -vv 参数是否能正确解析占位符
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试不同的 mysqlbinlog 参数组合
const testConfigs = [
  {
    name: '原始参数（可能有$占位符）',
    args: ['mysql-bin.000001'] // 假设的binlog文件
  },
  {
    name: '新参数（应该解决$占位符问题）',
    args: ['--base64-output=DECODE-ROWS', '-vv', 'mysql-bin.000001']
  }
];

function testMysqlbinlogOutput(config) {
  return new Promise((resolve, reject) => {
    console.log(`\n测试配置: ${config.name}`);
    console.log(`参数: mysqlbinlog ${config.args.join(' ')}`);
    
    const mysqlbinlog = spawn('mysqlbinlog', config.args);
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
        console.log(`❌ 执行失败 (退出代码: ${code})`);
        console.log(`错误信息: ${error}`);
        resolve({ success: false, error, output: '' });
      } else {
        console.log(`✅ 执行成功`);
        
        // 分析输出中的占位符情况
        const lines = output.split('\n');
        const sampleLines = lines.slice(0, 20).filter(line => line.trim());
        
        const hasPlaceholders = output.includes('$1') || output.includes('$2');
        const hasDetailedFormat = output.includes('@1=') || output.includes('@2=');
        const hasTypeInfo = output.includes('meta=') || output.includes('nullable=');
        
        console.log(`输出分析:`);
        console.log(`  - 包含$占位符: ${hasPlaceholders ? '是' : '否'}`);
        console.log(`  - 包含@列格式: ${hasDetailedFormat ? '是' : '否'}`);
        console.log(`  - 包含类型信息: ${hasTypeInfo ? '是' : '否'}`);
        console.log(`  - 总行数: ${lines.length}`);
        
        if (sampleLines.length > 0) {
          console.log(`前几行样本:`);
          sampleLines.slice(0, 5).forEach((line, i) => {
            console.log(`  ${i + 1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
          });
        }
        
        resolve({ 
          success: true, 
          output, 
          analysis: {
            hasPlaceholders,
            hasDetailedFormat,
            hasTypeInfo,
            totalLines: lines.length
          }
        });
      }
    });
    
    mysqlbinlog.on('error', (err) => {
      console.log(`❌ 执行错误: ${err.message}`);
      resolve({ success: false, error: err.message, output: '' });
    });
  });
}

async function runTests() {
  console.log('🔍 测试 mysqlbinlog 参数效果\n');
  
  // 检查是否有测试文件
  const testFile = path.join(__dirname, 'test-data', 'test-binlog.log');
  if (!fs.existsSync(testFile)) {
    console.log('⚠️  未找到测试文件，创建模拟测试...');
    console.log('请确保有真实的 binlog 文件进行测试');
    return;
  }
  
  // 更新测试配置使用实际文件
  testConfigs.forEach(config => {
    config.args = config.args.map(arg => 
      arg === 'mysql-bin.000001' ? testFile : arg
    );
  });
  
  const results = [];
  
  for (const config of testConfigs) {
    const result = await testMysqlbinlogOutput(config);
    results.push({ config, result });
    
    // 添加延迟避免过快执行
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 比较结果
  console.log('\n📊 测试结果对比:');
  results.forEach(({ config, result }, index) => {
    console.log(`\n${index + 1}. ${config.name}:`);
    if (result.success) {
      console.log(`   ✅ 成功执行`);
      if (result.analysis) {
        console.log(`   - $占位符: ${result.analysis.hasPlaceholders ? '存在' : '不存在'}`);
        console.log(`   - 详细格式: ${result.analysis.hasDetailedFormat ? '是' : '否'}`);
        console.log(`   - 类型信息: ${result.analysis.hasTypeInfo ? '是' : '否'}`);
      }
    } else {
      console.log(`   ❌ 执行失败: ${result.error}`);
    }
  });
  
  // 给出建议
  const newParamResult = results.find(r => r.config.name.includes('新参数'));
  if (newParamResult && newParamResult.result.success) {
    if (!newParamResult.result.analysis.hasPlaceholders) {
      console.log('\n🎉 新参数配置成功解决了$占位符问题！');
    } else {
      console.log('\n⚠️  新参数配置仍然存在$占位符，可能需要进一步调整');
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testMysqlbinlogOutput, runTests };