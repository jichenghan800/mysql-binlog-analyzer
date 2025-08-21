#!/usr/bin/env node

// 测试值解析和处理函数
function testValueParsing() {
  console.log('🧪 测试mysqlbinlog输出值解析');
  console.log('=====================================\n');
  
  // 模拟mysqlbinlog --base64-output=DECODE-ROWS -v 的输出格式
  const testLines = [
    '###   @1=30709978',
    '###   @2=3398850', 
    '###   @3=NULL',
    '###   @4=20700002140',
    '###   @5=1.00',
    '###   @6=NULL54',  // 问题值
    '###   @7=\'John\\\'s Name\'',
    '###   @8=\'2024-12-01 10:30:20\'',
    '###   @9=123.45',
    '###   @10=\'\'',
    '###   @11=0',
    '###   @12=1'
  ];
  
  console.log('原始mysqlbinlog输出行：');
  testLines.forEach(line => console.log(`  ${line}`));
  console.log('');
  
  // 当前的解析逻辑（有问题的）
  function parseValueCurrent(line) {
    const columnMatch = line.match(/###\s+@(\d+)=(.+)/);
    if (columnMatch) {
      const columnIndex = parseInt(columnMatch[1]);
      let value = columnMatch[2];
      
      // 当前的处理逻辑
      if (value && typeof value === 'string') {
        value = value
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .trim();
        
        if ((value.startsWith("'") && value.endsWith("'")) || 
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
      }
      
      return { column: columnIndex, value: value };
    }
    return null;
  }
  
  // 改进的解析逻辑
  function parseValueImproved(line) {
    const columnMatch = line.match(/###\s+@(\d+)=(.+)/);
    if (!columnMatch) return null;
    
    const columnIndex = parseInt(columnMatch[1]);
    let rawValue = columnMatch[2];
    
    // 处理NULL值
    if (rawValue === 'NULL') {
      return { column: columnIndex, value: null };
    }
    
    // 处理带引号的字符串
    if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
      // 移除外层引号并处理转义
      let stringValue = rawValue.slice(1, -1);
      // 处理转义的单引号
      stringValue = stringValue.replace(/\\'/g, "'");
      return { column: columnIndex, value: stringValue };
    }
    
    // 处理数字（包括小数）
    if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      return { column: columnIndex, value: rawValue };
    }
    
    // 处理其他情况 - 可能是损坏的值，需要清理
    let cleanValue = rawValue;
    
    // 移除非打印字符，但保留基本字符
    cleanValue = cleanValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // 检查是否是NULL后面跟了其他字符（如NULL54）
    if (cleanValue.startsWith('NULL') && cleanValue.length > 4) {
      // 这种情况通常是解析错误，应该是NULL
      return { column: columnIndex, value: null };
    }
    
    // 最终清理
    cleanValue = cleanValue.trim();
    
    return { column: columnIndex, value: cleanValue };
  }
  
  console.log('当前解析结果（有问题）：');
  testLines.forEach(line => {
    const result = parseValueCurrent(line);
    if (result) {
      console.log(`  col_${result.column} = ${JSON.stringify(result.value)}`);
    }
  });
  
  console.log('\n改进解析结果：');
  testLines.forEach(line => {
    const result = parseValueImproved(line);
    if (result) {
      console.log(`  col_${result.column} = ${JSON.stringify(result.value)}`);
    }
  });
  
  // 测试SQL生成
  console.log('\n生成的SQL对比：');
  
  function formatValue(value) {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (typeof value === 'string') {
      if (value === '') {
        return "''";
      }
      
      // 检查是否为纯数字
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        return value;
      }
      
      // 转义单引号并添加引号
      const escaped = value.replace(/'/g, "''");
      return `'${escaped}'`;
    }
    
    return String(value);
  }
  
  const testValues = testLines.map(line => parseValueImproved(line)).filter(Boolean);
  
  console.log('UPDATE语句示例：');
  const setPart = testValues.slice(0, 3).map(v => `col_${v.column} = ${formatValue(v.value)}`).join(', ');
  const wherePart = testValues.slice(3, 6).map(v => `col_${v.column} = ${formatValue(v.value)}`).join(' AND ');
  
  console.log(`UPDATE \`scm_supplydecision\`.\`t_order_demand_item\` SET ${setPart} WHERE ${wherePart};`);
  
  console.log('\n✅ 测试完成！');
  console.log('\n关键改进：');
  console.log('1. 正确识别NULL值');
  console.log('2. 处理NULL后跟字符的情况（如NULL54）');
  console.log('3. 改进字符串引号处理');
  console.log('4. 更好的数字识别');
}

testValueParsing();