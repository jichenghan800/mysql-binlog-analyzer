# MySQL Binlog 分析工具

一个用于解析和分析MySQL binlog文件的Web工具，支持可视化展示数据库操作记录，生成原始SQL和回滚SQL。

## 功能特性

- 📁 支持多种binlog文件格式 (.log, .bin, mysql-bin.*)
- 🔍 智能解析二进制和文本格式binlog
- 📊 可视化统计操作类型和数量
- 🎯 支持按时间、类型、数据库、表名筛选
- 🔄 自动生成原始SQL和回滚SQL
- 🎨 高亮显示SQL差异值
- 📱 响应式设计，支持移动端

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
# 或
node server.js
```

### 访问应用
- 本地访问: http://localhost:3000
- 局域网访问: http://[your-ip]:3000

## 使用说明

1. **上传binlog文件** - 支持拖拽或点击上传
2. **查看统计信息** - 自动显示操作类型统计
3. **筛选和排序** - 按多种条件筛选操作记录
4. **查看详情** - 点击查看按钮查看SQL详情
5. **复制SQL** - 一键复制原始SQL或回滚SQL

## 技术栈

- **后端**: Node.js + Express
- **前端**: Bootstrap 5 + Vanilla JavaScript
- **工具**: mysqlbinlog (MySQL官方工具)

## 部署说明

### Linux/WSL部署
```bash
# 克隆项目
git clone <repository-url>
cd mysql-binlog-analyzer

# 安装依赖
npm install

# 启动服务
npm start
```

### Windows部署
运行 `setup-windows-simple.bat` 配置网络转发

## 注意事项

- 确保系统已安装MySQL客户端工具 (mysqlbinlog)
- 大文件解析可能需要较长时间
- 建议在服务器环境下运行以获得更好性能

## 许可证

私有项目 - 仅供内部使用