#!/usr/bin/env node

// 测试缓冲区问题
function testBufferIssue() {
  console.log('🔍 测试缓冲区和行分割问题');
  console.log('=====================================\n');
  
  // 模拟可能导致问题的情况
  const problematicScenarios = [
    // 场景1: 正常情况
    "###   @47=NULL\n###   @48=1\n",
    
    // 场景2: 缓冲区边界问题
    "###   @47=NUL",  // 不完整的行
    "L\n###   @48=1\n", // 续行
    
    // 场景3: 字符混合
    "###   @47=NULL385\n", // 直接的问题值
    
    // 场景4: 多行混合
    "###   @46=NULL\n###   @47=NULL\n###   @48=1385\n",
    
    // 场景5: 特殊字符
    "###   @47=NULL\x00385\n"
  ];
  
  // 当前的解析逻辑
  function parseLineStrict(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('###   @')) return null;
    
    const columnMatch = trimmedLine.match(/^###\s+@(\d+)=(.+)$/);
    if (!columnMatch) {
      console.log(`❌ 无法匹配: "${trimmedLine}"`);
      return null;
    }
    
    const columnIndex = parseInt(columnMatch[1]);
    const rawValue = columnMatch[2];
    
    console.log(`🔍 解析列${columnIndex}: 原始="${rawValue}" (长度:${rawValue.length})`);
    
    // 检查原始值的字节
    for (let i = 0; i < rawValue.length; i++) {
      const char = rawValue[i];
      const code = char.charCodeAt(0);
      if (code < 32 || code > 126) {
        console.log(`  ⚠️ 位置${i}: 非打印字符 '${char}' (码:${code})`);
      }
    }
    
    let value = rawValue;
    
    if (rawValue === 'NULL') {
      value = null;
      console.log(`  ✅ 标准NULL`);
    } else if (/^NULL.+/.test(rawValue)) {
      console.log(`  🚨 发现NULL后跟字符: "${rawValue}"`);
      // 分析NULL后面的内容
      const suffix = rawValue.substring(4);
      console.log(`  🔍 NULL后缀: "${suffix}" (长度:${suffix.length})`);
      
      // 检查后缀字符
      for (let i = 0; i < suffix.length; i++) {
        const char = suffix[i];
        const code = char.charCodeAt(0);
        console.log(`    字符${i}: '${char}' (码:${code})`);
      }
      
      value = null; // 强制修复为NULL
      console.log(`  🔧 修复为NULL`);
    } else if (/^-?\d+$/.test(rawValue)) {
      value = rawValue;
      console.log(`  ✅ 数字: ${value}`);
    } else {
      console.log(`  ⚠️ 其他格式: "${rawValue}"`);
      value = rawValue;
    }
    
    return { column: columnIndex, value: value };
  }
  
  // 测试各种场景
  console.log('测试各种问题场景:\n');
  
  problematicScenarios.forEach((scenario, i) => {
    console.log(`场景 ${i + 1}:`);
    console.log(`输入: ${JSON.stringify(scenario)}`);
    
    // 按行分割
    const lines = scenario.split('\n').filter(line => line.trim());
    
    lines.forEach((line, j) => {
      console.log(`  行${j + 1}: "${line}"`);
      const result = parseLineStrict(line);
      if (result) {
        console.log(`    结果: col_${result.column} = ${JSON.stringify(result.value)}`);
      }
    });
    
    console.log('');
  });
  
  // 测试实际的问题值
  console.log('🔧 测试实际问题值:');
  const problemLine = "###   @47=NULL385";
  console.log(`问题行: "${problemLine}"`);
  
  const result = parseLineStrict(problemLine);
  if (result) {
    console.log(`解析结果: col_${result.column} = ${JSON.stringify(result.value)}`);
  }
  
  console.log('\n✅ 缓冲区问题测试完成！');
  console.log('\n💡 建议修复方案:');
  console.log('1. 在解析前检查NULL后是否跟随非法字符');
  console.log('2. 使用更严格的行边界检查');
  console.log('3. 添加字符编码验证');
}

testBufferIssue();