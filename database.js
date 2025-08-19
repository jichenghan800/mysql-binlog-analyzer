const mysql = require('mysql2/promise');

class DatabaseManager {
    constructor() {
        this.connection = null;
        this.useDatabase = process.env.USE_DATABASE === 'true';
    }

    async connect() {
        if (!this.useDatabase) return false;
        
        try {
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'binlog_analyzer'
            });
            
            await this.initTables();
            console.log('数据库连接成功');
            return true;
        } catch (error) {
            console.log('数据库连接失败，使用内存存储:', error.message);
            this.useDatabase = false;
            return false;
        }
    }

    async initTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS binlog_operations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(64) NOT NULL,
                type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
                database_name VARCHAR(64) NOT NULL,
                table_name VARCHAR(64) NOT NULL,
                timestamp DATETIME,
                server_id INT,
                set_values JSON,
                where_conditions JSON,
                values JSON,
                original_sql TEXT,
                reverse_sql TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session (session_id),
                INDEX idx_timestamp (timestamp),
                INDEX idx_type (type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `;
        
        await this.connection.execute(createTableSQL);
    }

    async saveOperations(sessionId, operations) {
        if (!this.useDatabase || !this.connection) {
            return false;
        }

        try {
            const insertSQL = `
                INSERT INTO binlog_operations 
                (session_id, type, database_name, table_name, timestamp, server_id, 
                 set_values, where_conditions, values, original_sql, reverse_sql)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const batchSize = 1000;
            for (let i = 0; i < operations.length; i += batchSize) {
                const batch = operations.slice(i, i + batchSize);
                const values = batch.map(op => [
                    sessionId,
                    op.type,
                    op.database,
                    op.table,
                    op.timestamp,
                    op.serverId,
                    JSON.stringify(op.setValues || []),
                    JSON.stringify(op.whereConditions || []),
                    JSON.stringify(op.values || []),
                    op.originalSQL,
                    op.reverseSQL
                ]);

                for (const value of values) {
                    await this.connection.execute(insertSQL, value);
                }
                
                console.log(`已保存 ${Math.min(i + batchSize, operations.length)}/${operations.length} 条操作到数据库`);
            }

            return true;
        } catch (error) {
            console.error('保存到数据库失败:', error);
            return false;
        }
    }

    async getOperations(sessionId, filters = {}) {
        if (!this.useDatabase || !this.connection) {
            return null;
        }

        try {
            let sql = 'SELECT * FROM binlog_operations WHERE session_id = ?';
            const params = [sessionId];

            if (filters.type) {
                sql += ' AND type = ?';
                params.push(filters.type);
            }

            if (filters.database) {
                sql += ' AND database_name = ?';
                params.push(filters.database);
            }

            if (filters.table) {
                sql += ' AND table_name = ?';
                params.push(filters.table);
            }

            if (filters.startTime) {
                sql += ' AND timestamp >= ?';
                params.push(filters.startTime);
            }

            if (filters.endTime) {
                sql += ' AND timestamp <= ?';
                params.push(filters.endTime);
            }

            sql += ' ORDER BY timestamp DESC';

            if (filters.limit) {
                sql += ' LIMIT ?';
                params.push(parseInt(filters.limit));
            }

            const [rows] = await this.connection.execute(sql, params);
            
            return rows.map(row => ({
                type: row.type,
                database: row.database_name,
                table: row.table_name,
                timestamp: row.timestamp,
                serverId: row.server_id,
                setValues: JSON.parse(row.set_values || '[]'),
                whereConditions: JSON.parse(row.where_conditions || '[]'),
                values: JSON.parse(row.values || '[]'),
                originalSQL: row.original_sql,
                reverseSQL: row.reverse_sql
            }));
        } catch (error) {
            console.error('从数据库获取数据失败:', error);
            return null;
        }
    }

    async clearSession(sessionId) {
        if (!this.useDatabase || !this.connection) {
            return false;
        }

        try {
            await this.connection.execute('DELETE FROM binlog_operations WHERE session_id = ?', [sessionId]);
            return true;
        } catch (error) {
            console.error('清理数据库会话失败:', error);
            return false;
        }
    }

    generateSessionId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = DatabaseManager;