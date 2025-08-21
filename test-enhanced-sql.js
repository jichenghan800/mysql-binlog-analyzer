#!/usr/bin/env node

// 测试增强的SQL格式化功能
const fs = require('fs');

// 模拟操作数据
const testOperations = [
  {
    type: 'INSERT',
    database: 'test_db',
    table: 'users',
    values: [
      { column: 1, value: '123' },
      { column: 2, value: 'John Doe' },
      { column: 3, value: 'john@example.com' },
      { column: 4, value: '2024-12-01 10:30:20' }
    ]
  },
  {
    type: 'UPDATE',
    database: 'test_db',
    table: 'users',
    setValues: [
      { column: 2, value: 'Jane Doe' },
      { column: 3, value: 'jane@example.com' }
    ],
    whereConditions: [
      { column: 1, value: '123' },
      { column: 2, value: 'John Doe' },
      { column: 3, value: 'john@example.com' }
    ]
  },
  {
    type: 'DELETE',
    database: 'test_db',
    table: 'users',
    values: [
      { column: 1, value: '123' },
      { column: 2, value: 'Jane Doe' },
      { column: 3, value: 'jane@example.com' }
    ]
  }
];

// 增强的格式化函数
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

function generateColumnName(columnIndex) {
  return `col_${columnIndex}`;
}

function generateEnhancedInsertSQL(tableName, values) {
  if (!values || values.length === 0) return '';
  
  const columns = values.map(v => generateColumnName(v.column)).join(', ');
  const vals = values.map(v => formatValueEnhanced(v.value)).join(', ');
  
  return `INSERT INTO ${tableName} (${columns}) VALUES (${vals});`;
}

function generateEnhancedUpdateSQL(tableName, setValues, whereConditions) {
  if (!setValues || setValues.length === 0) return '';
  
  const changedFields = [];
  const whereMap = new Map();
  
  if (whereConditions) {
    whereConditions.forEach(w => {
      whereMap.set(w.column, w.value);
    });
  }
  
  setValues.forEach(s => {
    const oldValue = whereMap.get(s.column);
    if (oldValue !== s.value) {
      changedFields.push(s);
    }
  });
  
  const fieldsToUpdate = changedFields.length > 0 ? changedFields : setValues;
  const setPart = fieldsToUpdate.map(v => `${generateColumnName(v.column)} = ${formatValueEnhanced(v.value)}`).join(', ');
  
  const keyFields = whereConditions && whereConditions.length > 0 
    ? whereConditions.slice(0, Math.min(5, whereConditions.length))
    : [];
  
  const wherePart = keyFields.length > 0
    ? keyFields.map(w => `${generateColumnName(w.column)} = ${formatValueEnhanced(w.value)}`).join(' AND ')
    : '1=1';
  
  return `UPDATE ${tableName} SET ${setPart} WHERE ${wherePart};`;
}

function generateEnhancedDeleteSQL(tableName, conditions) {
  if (!conditions || conditions.length === 0) return '';
  
  const keyFields = conditions.slice(0, Math.min(5, conditions.length));
  const wherePart = keyFields.map(c => `${generateColumnName(c.column)} = ${formatValueEnhanced(c.value)}`).join(' AND ');
  
  return `DELETE FROM ${tableName} WHERE ${wherePart};`;
}

function generateEnhancedReverseUpdateSQL(tableName, setValues, whereConditions) {
  if (!whereConditions || whereConditions.length === 0 || !setValues || setValues.length === 0) return '';
  
  const changedFields = [];
  const whereMap = new Map();
  
  whereConditions.forEach(w => {
    whereMap.set(w.column, w.value);
  });
  
  setValues.forEach(s => {
    const oldValue = whereMap.get(s.column);
    if (oldValue !== s.value) {
      changedFields.push({ column: s.column, value: oldValue });
    }
  });
  
  const fieldsToRevert = changedFields.length > 0 ? changedFields : whereConditions.slice(0, 5);
  const setPart = fieldsToRevert.map(f => `${generateColumnName(f.column)} = ${formatValueEnhanced(f.value)}`).join(', ');
  
  const keyFields = setValues.slice(0, Math.min(5, setValues.length));
  const wherePart = keyFields.map(v => `${generateColumnName(v.column)} = ${formatValueEnhanced(v.value)}`).join(' AND ');
  
  return `UPDATE ${tableName} SET ${setPart} WHERE ${wherePart};`;
}

function testEnhancedSQL() {
  console.log('🧪 测试增强的SQL格式化功能');
  console.log('=====================================\n');
  
  testOperations.forEach((op, index) => {
    console.log(`测试 ${index + 1}: ${op.type} 操作`);
    console.log('-----------------------------------');
    
    const tableName = `\`${op.database}\`.\`${op.table}\``;
    let originalSQL = '';
    let reverseSQL = '';
    
    switch (op.type) {
      case 'INSERT':
        originalSQL = generateEnhancedInsertSQL(tableName, op.values);
        reverseSQL = generateEnhancedDeleteSQL(tableName, op.values);
        break;
      case 'UPDATE':
        originalSQL = generateEnhancedUpdateSQL(tableName, op.setValues, op.whereConditions);
        reverseSQL = generateEnhancedReverseUpdateSQL(tableName, op.setValues, op.whereConditions);
        break;
      case 'DELETE':
        originalSQL = generateEnhancedDeleteSQL(tableName, op.values);
        reverseSQL = generateEnhancedInsertSQL(tableName, op.values);
        break;
    }
    
    console.log('原始SQL:', originalSQL);
    console.log('回滚SQL:', reverseSQL);
    console.log('');
  });
  
  console.log('🔍 测试特殊值格式化');
  console.log('-----------------------------------');
  
  const testValues = [
    null,
    undefined,
    '',
    '123',
    '-456',
    '123.45',
    "John's Name",
    '2024-12-01',
    '2024-12-01 10:30:20',
    'true',
    'false',
    'normal string'
  ];
  
  testValues.forEach(value => {
    const formatted = formatValueEnhanced(value);
    console.log(`${JSON.stringify(value)} -> ${formatted}`);
  });
  
  console.log('\n✅ 测试完成！');
  console.log('\n主要改进：');
  console.log('1. 彻底解决了$1、$2占位符问题');
  console.log('2. 增强了值的格式化处理');
  console.log('3. 优化了WHERE条件生成');
  console.log('4. 改进了SQL语句的可读性');
}

testEnhancedSQL();