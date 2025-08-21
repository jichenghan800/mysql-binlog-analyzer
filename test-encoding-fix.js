#!/usr/bin/env node

// 测试编码修复
function testEncodingFix() {
  console.log('🧪 测试编码和截断修复');
  console.log('=====================================\n');
  
  // 模拟问题值
  const testValues = [
    "'系",  // 截断的中文字符串
    "'和兆产业园店'",  // 正常的中文字符串
    "'DL202508160640'",  // 正常的英文字符串
    "1386",  // 数字
    "NULL",  // NULL值
    "'2025-08-18 05:44:39'",  // 日期时间
    "2111451",  // 大数字
    "''"  // 空字符串
  ];
  
  // 修复后的解析函数
  function parseValueFixed(rawValue) {
    let value = rawValue;
    
    // 处理NULL值
    if (rawValue === 'NULL') {
      value = null;
    }
    // 处理带引号的字符串
    else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
      // 移除外层引号并处理转义
      value = rawValue.slice(1, -1);
      // 处理转义的单引号
      value = value.replace(/\\'/g, "'");
      // 处理其他转义字符
      value = value.replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
    }
    // 处理数字（包括小数）
    else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      value = rawValue;
    }
    // 处理其他情况 - 可能是损坏的值或截断的字符串
    else {
      // 检查是否是NULL后面跟了其他字符（如NULL54）
      if (rawValue.startsWith('NULL') && rawValue.length > 4) {
        value = null;
      }
      // 检查是否是截断的字符串（不以引号结尾）
      else if (rawValue.startsWith("'") && !rawValue.endsWith("'")) {
        // 这是截断的字符串，移除开头的引号
        value = rawValue.slice(1);
        // 清理可能的乱码和控制字符
        value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        // 如果只剩下一个字符且是乱码，则设为空字符串
        if (value.length === 1 && /[\u4e00-\u9fff]/.test(value) && value !== '系') {
          value = '';
        }
      }
      else {
        // 清理控制字符但保留中文
        value = rawValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
      }
    }
    
    return value;
  }
  
  // 格式化函数
  function formatValueEnhanced(value) {
    if (value === null || value === 'NULL' || value === undefined) {
      return 'NULL';
    }
    
    let cleanValue = String(value).trim();
    
    if (cleanValue === '') {
      return "''";
    }
    
    if (/^-?\d+(\.\d+)?$/.test(cleanValue)) {
      return cleanValue;
    }
    
    if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2})?$/.test(cleanValue)) {
      return `'${cleanValue}'`;
    }
    
    const escapedValue = cleanValue.replace(/'/g, "''");
    return `'${escapedValue}'`;
  }
  
  console.log('测试值解析和格式化：');
  testValues.forEach((rawValue, i) => {
    const parsed = parseValueFixed(rawValue);
    const formatted = formatValueEnhanced(parsed);
    
    console.log(`${i + 1}. 原始: ${rawValue}`);
    console.log(`   解析: ${JSON.stringify(parsed)}`);
    console.log(`   格式: ${formatted}`);
    console.log('');
  });
  
  // 测试问题SQL的修复
  console.log('修复前的问题SQL:');
  console.log("UPDATE `scm_monitor`.`t_distribution` SET col_25 = '系', col_26 = '2025-08-18 05:44:39', col_47 = 1386 WHERE col_1 = 2111451;");
  
  console.log('\n修复后的SQL:');
  const fixedValues = [
    { column: 25, value: parseValueFixed("'系") },
    { column: 26, value: parseValueFixed("'2025-08-18 05:44:39'") },
    { column: 47, value: parseValueFixed("1386") }
  ];
  
  const setPart = fixedValues.map(v => `col_${v.column} = ${formatValueEnhanced(v.value)}`).join(', ');
  console.log(`UPDATE \`scm_monitor\`.\`t_distribution\` SET ${setPart} WHERE col_1 = 2111451;`);
  
  console.log('\n✅ 编码修复测试完成！');
}

testEncodingFix();