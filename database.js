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
                operation_values JSON,
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
                 set_values, where_conditions, operation_values, original_sql, reverse_sql)
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

    async getOperations(sessionId, options = {}) {
        if (!this.useDatabase || !this.connection) {
            return null;
        }

        try {
            const { page = 1, pageSize = 50, sortBy = 'timestamp', sortOrder = 'desc', filters = {} } = options;
            
            // 构建查询条件
            let whereClause = 'WHERE session_id = ?';
            const params = [sessionId];

            if (filters.type) {
                whereClause += ' AND type = ?';
                params.push(filters.type);
            }

            if (filters.database) {
                whereClause += ' AND database_name = ?';
                params.push(filters.database);
            }

            if (filters.table) {
                whereClause += ' AND table_name = ?';
                params.push(filters.table);
            }

            if (filters.startTime) {
                whereClause += ' AND timestamp >= ?';
                params.push(filters.startTime);
            }

            if (filters.endTime) {
                whereClause += ' AND timestamp <= ?';
                params.push(filters.endTime);
            }

            // 获取总数
            const countSQL = `SELECT COUNT(*) as total FROM binlog_operations ${whereClause}`;
            const [countResult] = await this.connection.execute(countSQL, params);
            const total = countResult[0].total;

            // 构建排序子句
            const sortColumn = {
                'timestamp': 'timestamp',
                'type': 'type',
                'database': 'database_name',
                'table': 'table_name'
            }[sortBy] || 'timestamp';
            
            const orderClause = `ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
            
            // 分页
            const offset = (page - 1) * pageSize;
            const limitClause = `LIMIT ${pageSize} OFFSET ${offset}`;

            // 执行查询
            const dataSQL = `SELECT * FROM binlog_operations ${whereClause} ${orderClause} ${limitClause}`;
            const [rows] = await this.connection.execute(dataSQL, params);
            
            const operations = rows.map(row => ({
                type: row.type,
                database: row.database_name,
                table: row.table_name,
                timestamp: row.timestamp,
                serverId: row.server_id,
                setValues: JSON.parse(row.set_values || '[]'),
                whereConditions: JSON.parse(row.where_conditions || '[]'),
                values: JSON.parse(row.operation_values || '[]'),
                originalSQL: row.original_sql,
                reverseSQL: row.reverse_sql
            }));

            return {
                data: operations,
                total: total,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error('从数据库获取数据失败:', error);
            return null;
        }
    }

    async getStatistics(sessionId) {
        if (!this.useDatabase || !this.connection) {
            return null;
        }

        try {
            const stats = {
                total: 0,
                byType: {},
                byTable: {},
                byDatabase: {},
                timeline: {}
            };

            // 获取总数
            const [totalResult] = await this.connection.execute(
                'SELECT COUNT(*) as total FROM binlog_operations WHERE session_id = ?',
                [sessionId]
            );
            stats.total = totalResult[0].total;

            // 按类型统计
            const [typeResult] = await this.connection.execute(
                'SELECT type, COUNT(*) as count FROM binlog_operations WHERE session_id = ? GROUP BY type',
                [sessionId]
            );
            typeResult.forEach(row => {
                stats.byType[row.type] = row.count;
            });

            // 按数据库统计
            const [dbResult] = await this.connection.execute(
                'SELECT database_name, COUNT(*) as count FROM binlog_operations WHERE session_id = ? GROUP BY database_name',
                [sessionId]
            );
            dbResult.forEach(row => {
                stats.byDatabase[row.database_name] = row.count;
            });

            // 按表统计
            const [tableResult] = await this.connection.execute(
                'SELECT CONCAT(database_name, ".", table_name) as table_key, COUNT(*) as count FROM binlog_operations WHERE session_id = ? GROUP BY database_name, table_name',
                [sessionId]
            );
            tableResult.forEach(row => {
                stats.byTable[row.table_key] = row.count;
            });

            // 按小时统计
            const [timeResult] = await this.connection.execute(
                'SELECT HOUR(timestamp) as hour, COUNT(*) as count FROM binlog_operations WHERE session_id = ? AND timestamp IS NOT NULL GROUP BY HOUR(timestamp)',
                [sessionId]
            );
            timeResult.forEach(row => {
                stats.timeline[row.hour.toString().padStart(2, '0')] = row.count;
            });

            return stats;
        } catch (error) {
            console.error('获取统计信息失败:', error);
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

    async getFilterOptions(sessionId) {
        if (!this.useDatabase || !this.connection) {
            return null;
        }

        try {
            const options = {
                databases: [],
                tables: []
            };

            // 获取数据库列表
            const [dbResult] = await this.connection.execute(
                'SELECT DISTINCT database_name FROM binlog_operations WHERE session_id = ? ORDER BY database_name',
                [sessionId]
            );
            options.databases = dbResult.map(row => row.database_name);

            // 获取表列表
            const [tableResult] = await this.connection.execute(
                'SELECT DISTINCT CONCAT(database_name, ".", table_name) as table_name FROM binlog_operations WHERE session_id = ? ORDER BY database_name, table_name',
                [sessionId]
            );
            options.tables = tableResult.map(row => row.table_name);

            return options;
        } catch (error) {
            console.error('获取筛选选项失败:', error);
            return null;
        }
    }

    generateSessionId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = DatabaseManager;