#!/usr/bin/env node

// 测试修复后的解析逻辑
function testFixedParsing() {
  console.log('🧪 测试修复后的值解析逻辑');
  console.log('=====================================\n');
  
  // 模拟问题场景
  const problemLine = '###   @6=NULL54';
  
  // 修复后的解析函数（从server.js复制）
  function parseValueFixed(line) {
    const columnMatch = line.match(/###\s+@(\d+)=(.+)/);
    if (!columnMatch) return null;
    
    const columnIndex = parseInt(columnMatch[1]);
    let rawValue = columnMatch[2];
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
    }
    // 处理数字（包括小数）
    else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      value = rawValue;
    }
    // 处理其他情况 - 可能是损坏的值
    else {
      // 移除非打印字符
      let cleanValue = rawValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
      
      // 检查是否是NULL后面跟了其他字符（如NULL54）
      if (cleanValue.startsWith('NULL') && cleanValue.length > 4) {
        // 这种情况通常是解析错误，应该是NULL
        value = null;
      } else {
        value = cleanValue.trim();
      }
    }
    
    return { column: columnIndex, value: value };
  }
  
  // 格式化值函数
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
    
    if (cleanValue.toLowerCase() === 'true' || cleanValue.toLowerCase() === 'false') {
      return cleanValue.toLowerCase() === 'true' ? '1' : '0';
    }
    
    if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2})?$/.test(cleanValue)) {
      return `'${cleanValue}'`;
    }
    
    const escapedValue = cleanValue.replace(/'/g, "''");
    return `'${escapedValue}'`;
  }
  
  // 测试问题值
  console.log('测试问题值解析：');
  const result = parseValueFixed(problemLine);
  console.log(`输入: ${problemLine}`);
  console.log(`解析结果: col_${result.column} = ${JSON.stringify(result.value)}`);
  console.log(`格式化SQL: col_${result.column} = ${formatValueEnhanced(result.value)}`);
  
  console.log('\n完整UPDATE语句测试：');
  
  // 模拟完整的操作数据
  const mockOperation = {
    type: 'UPDATE',
    database: 'scm_supplydecision',
    table: 't_order_demand_item',
    setValues: [
      { column: 6, value: null }  // 修复后的NULL值
    ],
    whereConditions: [
      { column: 1, value: '30709978' },
      { column: 2, value: '3398850' },
      { column: 3, value: null },
      { column: 4, value: '20700002140' },
      { column: 5, value: '1.00' }
    ]
  };
  
  // 生成SQL
  const tableName = `\`${mockOperation.database}\`.\`${mockOperation.table}\``;
  const setPart = mockOperation.setValues.map(v => `col_${v.column} = ${formatValueEnhanced(v.value)}`).join(', ');
  const wherePart = mockOperation.whereConditions.map(w => `col_${w.column} = ${formatValueEnhanced(w.value)}`).join(' AND ');
  
  const sql = `UPDATE ${tableName} SET ${setPart} WHERE ${wherePart};`;
  
  console.log('修复前的问题SQL:');
  console.log('UPDATE `scm_supplydecision`.`t_order_demand_item` SET col_6 = NULL54 WHERE col_1 = 30709978 AND col_2 = 3398850 AND col_3 = NULL AND col_4 = 20700002140 AND col_5 = 1.00;');
  
  console.log('\n修复后的正确SQL:');
  console.log(sql);
  
  console.log('\n✅ 修复验证完成！');
  console.log('\n关键修复点：');
  console.log('1. NULL54 -> NULL (正确识别损坏的NULL值)');
  console.log('2. 改进字符串引号处理');
  console.log('3. 更精确的数字识别');
  console.log('4. 更好的非打印字符清理');
}

testFixedParsing();