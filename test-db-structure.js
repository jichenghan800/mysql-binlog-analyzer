#!/usr/bin/env node

// 测试数据库结构和插入
const mysql = require('mysql2/promise');

async function testDatabaseStructure() {
  console.log('🔍 测试数据库结构');
  console.log('=====================================\n');
  
  try {
    // 连接数据库
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'test_binlog'
    });
    
    console.log('✅ 数据库连接成功');
    
    // 创建测试表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS test_binlog_operations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
        database_name VARCHAR(64) NOT NULL,
        table_name VARCHAR(64) NOT NULL,
        timestamp DATETIME,
        xid VARCHAR(32),
        gtid VARCHAR(128),
        set_values JSON,
        where_conditions JSON,
        operation_values JSON,
        original_sql TEXT,
        reverse_sql TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await connection.execute('DROP TABLE IF EXISTS test_binlog_operations');
    await connection.execute(createTableSQL);
    console.log('✅ 测试表创建成功');
    
    // 测试插入数据
    const testData = {
      session_id: 'test123',
      type: 'UPDATE',
      database_name: 'scm_monitor',
      table_name: 't_material_spec_stock',
      timestamp: '2025-08-18 05:44:35',
      xid: null,
      gtid: '1da7f675-3c36-11f0-96ec-fa163e2398fa:319493340',
      set_values: JSON.stringify([{column: 1, value: '22155171'}]),
      where_conditions: JSON.stringify([{column: 1, value: '22155171'}]),
      operation_values: JSON.stringify([]),
      original_sql: 'UPDATE `scm_monitor`.`t_material_spec_stock` SET col_1 = 22155171 WHERE col_1 = 22155171;',
      reverse_sql: 'UPDATE `scm_monitor`.`t_material_spec_stock` SET col_1 = 22155171 WHERE col_1 = 22155171;'
    };
    
    const insertSQL = `
      INSERT INTO test_binlog_operations 
      (session_id, type, database_name, table_name, timestamp, xid, gtid,
       set_values, where_conditions, operation_values, original_sql, reverse_sql)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      testData.session_id,
      testData.type,
      testData.database_name,
      testData.table_name,
      testData.timestamp,
      testData.xid,
      testData.gtid,
      testData.set_values,
      testData.where_conditions,
      testData.operation_values,
      testData.original_sql,
      testData.reverse_sql
    ];
    
    console.log('🧪 测试插入数据...');
    console.log('参数数量:', values.length);
    console.log('SQL占位符数量:', (insertSQL.match(/\?/g) || []).length);
    
    await connection.execute(insertSQL, values);
    console.log('✅ 数据插入成功');
    
    // 查询验证
    const [rows] = await connection.execute('SELECT * FROM test_binlog_operations WHERE session_id = ?', [testData.session_id]);
    console.log('✅ 查询成功，记录数:', rows.length);
    
    if (rows.length > 0) {
      console.log('📋 插入的数据:');
      console.log('  ID:', rows[0].id);
      console.log('  类型:', rows[0].type);
      console.log('  数据库:', rows[0].database_name);
      console.log('  表:', rows[0].table_name);
      console.log('  时间戳:', rows[0].timestamp);
      console.log('  XID:', rows[0].xid);
      console.log('  GTID:', rows[0].gtid);
    }
    
    // 清理
    await connection.execute('DROP TABLE test_binlog_operations');
    await connection.end();
    
    console.log('\n✅ 数据库结构测试通过！');
    console.log('问题不在数据库结构，可能在数据处理逻辑中');
    
  } catch (error) {
    console.error('❌ 数据库测试失败:', error.message);
    console.error('错误代码:', error.code);
    console.error('SQL状态:', error.sqlState);
  }
}

testDatabaseStructure();