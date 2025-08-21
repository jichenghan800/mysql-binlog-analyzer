#!/usr/bin/env node

// 测试真实的解析场景
function testRealParsing() {
  console.log('🔍 测试真实解析场景');
  console.log('=====================================\n');
  
  // 真实的mysqlbinlog输出行
  const realLines = [
    "###   @1=2111234",
    "###   @2='DL202508160424'",
    "###   @5='南浔古镇店'",
    "###   @8=NULL",
    "###   @24=-1 (18446744073709551615)",
    "###   @25='系统'",
    "###   @26='2025-08-17 16:17:55'",
    "###   @36='南浔区泰安路68号（巨人君澜酒店大门东侧）'",
    "###   @47=NULL",
    "###   @47=1386"  // 模拟可能的问题值
  ];
  
  // 当前的解析函数（从server.js复制并改进）
  function parseValueReal(line) {
    // 使用更严格的正则表达式，确保完整匹配一行
    const columnMatch = line.match(/^###\s+@(\d+)=(.+)$/);
    if (!columnMatch) {
      console.log(`❌ 无法匹配行: "${line}"`);
      return null;
    }
    
    const columnIndex = parseInt(columnMatch[1]);
    const rawValue = columnMatch[2].trim(); // 去除首尾空格
    let value = rawValue;
    
    console.log(`🔍 解析列${columnIndex}: "${rawValue}"`);
    
    // 严格按照mysqlbinlog输出格式解析
    if (rawValue === 'NULL') {
      // 精确匹配NULL
      value = null;
      console.log(`  ✅ NULL值`);
    } else if (rawValue.startsWith("'") && rawValue.endsWith("'") && rawValue.length >= 2) {
      // 完整的引号字符串
      value = rawValue.slice(1, -1);
      // 处理转义字符
      value = value.replace(/\\'/g, "'").replace(/\\\\/g, "\\").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
      console.log(`  ✅ 字符串: "${value}"`);
    } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      // 纯数字（整数或小数）
      value = rawValue;
      console.log(`  ✅ 数字: ${value}`);
    } else if (/^-?\d+\s+\(.+\)$/.test(rawValue)) {
      // 特殊格式：数字后跟括号，如 "-1 (18446744073709551615)"
      const numberMatch = rawValue.match(/^(-?\d+)\s+\(.+\)$/);
      if (numberMatch) {
        value = numberMatch[1];
        console.log(`  ✅ 特殊数字格式: ${value} (忽略括号部分)`);
      } else {
        value = rawValue;
        console.log(`  ⚠️ 未知特殊格式: ${rawValue}`);
      }
    } else {
      // 其他情况 - 可能是解析错误或损坏的数据
      console.log(`  ⚠️ 未知格式: "${rawValue}"`);
      
      // 尝试修复常见问题
      if (rawValue.startsWith('NULL') && /^NULL\d+/.test(rawValue)) {
        // NULL后跟数字的情况，强制设为NULL
        console.log(`  🔧 修复: ${rawValue} -> NULL`);
        value = null;
      } else if (rawValue.startsWith("'") && !rawValue.endsWith("'")) {
        // 不完整的引号字符串，可能是截断
        console.log(`  🔧 修复截断字符串: ${rawValue}`);
        value = rawValue.startsWith("'") ? rawValue.slice(1) : rawValue;
        // 清理控制字符
        value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      } else {
        // 保持原值但清理控制字符
        value = rawValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        console.log(`  🔧 清理后: "${value}"`);
      }
    }
    
    return { column: columnIndex, value: value };
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
  
  console.log('测试真实行解析：\n');
  
  const results = [];
  realLines.forEach((line, i) => {
    console.log(`${i + 1}. 输入: ${line}`);
    const result = parseValueReal(line);
    if (result) {
      const formatted = formatValueEnhanced(result.value);
      console.log(`   输出: col_${result.column} = ${formatted}`);
      results.push(result);
    }
    console.log('');
  });
  
  // 生成SQL示例
  console.log('🔧 生成SQL示例:');
  
  // 模拟UPDATE操作
  const setValues = results.slice(0, 3);
  const whereValues = results.slice(3, 6);
  
  if (setValues.length > 0 && whereValues.length > 0) {
    const setPart = setValues.map(v => `col_${v.column} = ${formatValueEnhanced(v.value)}`).join(', ');
    const wherePart = whereValues.map(v => `col_${v.column} = ${formatValueEnhanced(v.value)}`).join(' AND ');
    
    console.log(`UPDATE \`scm_monitor\`.\`t_distribution\` SET ${setPart} WHERE ${wherePart};`);
  }
  
  console.log('\n✅ 真实解析测试完成！');
}

testRealParsing();