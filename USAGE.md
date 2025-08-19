# 使用说明

## 🚀 快速开始

### 1. 安装和启动
```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 或者开发模式
npm run dev
```

### 2. 生成测试数据
```bash
# 生成测试binlog文件
npm run generate-test
```

### 3. 访问应用
打开浏览器访问 `http://localhost:3000`

## 📋 功能详解

### 原始SQL和回滚SQL

#### 什么是原始SQL？
原始SQL是根据binlog中记录的操作重构出的SQL语句，表示当时执行的操作。

**示例：**
- INSERT操作：`INSERT INTO test_db.users (col_1, col_2, col_3) VALUES (1001, '张三', 'zhangsan@example.com');`
- UPDATE操作：`UPDATE test_db.users SET col_3 = 'zhangsan@newmail.com' WHERE col_1 = 1001;`
- DELETE操作：`DELETE FROM test_db.users WHERE col_1 = 1001;`

#### 什么是回滚SQL？
回滚SQL是用于撤销原始操作的SQL语句，主要用于数据回滚。

**示例：**
- INSERT的回滚：`DELETE FROM test_db.users WHERE col_1 = 1001;`
- UPDATE的回滚：`UPDATE test_db.users SET col_3 = 'zhangsan@example.com' WHERE col_1 = 1001;`
- DELETE的回滚：`INSERT INTO test_db.users (col_1, col_2, col_3) VALUES (1001, '张三', 'zhangsan@example.com');`

### 使用场景

#### 1. 数据恢复
当误操作导致数据丢失或错误时，可以使用回滚SQL进行数据恢复：
```sql
-- 如果误删了数据，使用回滚SQL恢复
INSERT INTO users (id, name, email) VALUES (1001, '张三', 'zhangsan@example.com');
```

#### 2. 操作审计
通过查看原始SQL了解数据库的具体操作：
```sql
-- 查看具体的更新操作
UPDATE users SET email = 'newemail@example.com' WHERE id = 1001;
```

#### 3. 数据同步
将原始SQL应用到其他数据库实例进行数据同步。

#### 4. 故障分析
分析binlog中的操作模式，找出可能的性能问题或异常操作。

## 🔧 界面操作指南

### 上传文件
1. 点击上传区域或拖拽binlog文件
2. 等待解析完成
3. 查看解析结果

### 查看统计
- **总操作数**：显示binlog中的总操作数量
- **操作类型统计**：INSERT、UPDATE、DELETE的分别统计
- **实时筛选**：根据筛选条件动态更新统计

### 筛选和排序
- **操作类型筛选**：只显示特定类型的操作
- **数据库筛选**：按数据库名称筛选
- **表名筛选**：按表名筛选
- **排序选项**：按时间、类型、数据库、表名排序

### 查看SQL
1. **原始SQL按钮**：点击查看重构的原始SQL语句
2. **回滚SQL按钮**：点击查看用于回滚的回滚SQL
3. **复制功能**：一键复制SQL到剪贴板
4. **语法高亮**：SQL语句带有语法高亮显示

### 查看详情
点击"查看详情"按钮可以看到：
- 操作的完整上下文信息
- 具体的列值和WHERE条件
- 同时显示原始SQL和回滚SQL
- 操作时间和服务器信息

## ⚠️ 注意事项

### 1. 列名显示
由于binlog中只记录列的位置索引，工具显示为 `col_1`, `col_2` 等。在实际使用时，需要根据表结构替换为真实的列名。

### 2. 数据类型
工具会尝试识别数值和字符串类型，但复杂数据类型可能需要手动调整。

### 3. 事务信息
当前版本主要关注DML操作（INSERT、UPDATE、DELETE），事务边界信息在详情中可见。

### 4. 性能考虑
- 大型binlog文件解析可能需要较长时间
- 建议在服务器环境中运行以获得最佳性能
- 可以使用筛选功能减少显示的数据量

## 🛠️ 故障排除

### mysqlbinlog命令未找到
```bash
# Ubuntu/Debian
sudo apt-get install mysql-client

# CentOS/RHEL
sudo yum install mysql

# macOS
brew install mysql-client
```

### 解析失败
1. 确认文件是有效的MySQL binlog文件
2. 检查文件权限
3. 查看服务器日志获取详细错误信息

### 性能问题
1. 增加服务器内存
2. 使用筛选功能减少数据量
3. 考虑分批处理大文件

## 📝 最佳实践

### 1. 数据恢复流程
1. 备份当前数据
2. 分析binlog找到问题操作
3. 生成回滚SQL
4. 在测试环境验证
5. 在生产环境执行恢复

### 2. 审计分析
1. 定期分析binlog了解数据变化模式
2. 识别异常操作和性能瓶颈
3. 建立操作基线和告警机制

### 3. 开发调试
1. 使用工具验证ORM生成的SQL
2. 分析批量操作的性能影响
3. 调试复杂的数据迁移脚本