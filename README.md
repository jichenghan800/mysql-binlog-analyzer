# MySQL Binlog 分析工具

<div align="center">

![MySQL Binlog Analyzer](public/icon.svg)

**一个强大的MySQL binlog文件解析和分析Web工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-14+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-支持-blue.svg)](https://www.docker.com/)

[功能特性](#功能特性) • [快速开始](#快速开始) • [部署方式](#部署方式) • [使用说明](#使用说明) • [技术架构](#技术架构)

</div>

## 🚀 功能特性

### 核心功能
- 📁 **多格式支持** - 支持二进制和文本格式binlog文件
- 🔍 **智能解析** - 自动识别文件格式，精确解析操作记录
- 🎯 **高级筛选** - 支持时间、类型、数据库、表名多维度筛选
- 🔄 **SQL生成** - 自动生成原始SQL和回滚SQL语句
- 🎨 **差异高亮** - 智能高亮显示字段变更，直观展示数据变化

### 性能优化
- ⚡ **高性能处理** - 支持GB级大文件解析
- 💾 **双存储模式** - 内存存储 + 数据库存储可选
- 📊 **分页展示** - 大数据量分页加载，响应迅速
- 🔧 **内存优化** - 智能内存管理，支持高内存服务器

### 用户体验
- 📱 **响应式设计** - 完美适配桌面端和移动端
- 🎪 **实时进度** - 文件解析进度实时显示
- 📈 **可视化统计** - 操作类型统计图表展示
- 🎛️ **灵活配置** - 支持环境变量和配置文件

## 🏃‍♂️ 快速开始

### 方式一：一键部署脚本 (推荐)

```bash
# Linux/macOS 完整一键部署（包含环境准备）
cd /opt && rm -rf mysql-binlog-analyzer && wget -O deploy-one-click.sh https://raw.githubusercontent.com/jichenghan800/mysql-binlog-analyzer/main/deploy-one-click.sh && chmod +x deploy-one-click.sh && sudo ./deploy-one-click.sh

# 或者简化版（需要预先安装Docker）
curl -fsSL https://raw.githubusercontent.com/jichenghan800/mysql-binlog-analyzer/main/deploy-docker.sh | bash
```

**一键部署脚本功能：**
- ✅ 自动检测操作系统并安装依赖
- ✅ 安装Docker和Docker Compose
- ✅ 创建工作目录和清理旧安装
- ✅ 下载最新代码并构建镜像
- ✅ 配置防火墙规则
- ✅ 创建管理脚本（start.sh, stop.sh, status.sh）
- ✅ 自动启动服务并检查状态

### 方式二：Docker 部署

```bash
# 克隆项目
git clone https://github.com/jichenghan800/mysql-binlog-analyzer.git
cd mysql-binlog-analyzer

# 内存存储模式 (适合小文件测试)
docker-compose up -d

# 数据库存储模式 (适合大文件生产环境)
docker-compose --profile with-database up -d
```

### 方式三：本地开发

```bash
# 1. 克隆项目
git clone https://github.com/jichenghan800/mysql-binlog-analyzer.git
cd mysql-binlog-analyzer

# 2. 安装依赖
npm install

# 3. 启动服务
npm start
```

**访问地址：** http://localhost:3000 (Docker部署为端口5000)

## 🐳 部署方式

### Docker 部署对比

| 部署命令 | 存储方式 | 适用场景 | 数据持久化 | 内存需求 |
|---------|---------|---------|-----------|---------|
| `docker-compose up -d` | 🧠 内存存储 | 小文件测试 | ❌ 重启丢失 | 2-16GB |
| `--profile with-database` | 💾 数据库存储 | 大文件生产 | ✅ 永久保存 | 1-8GB |

### 生产环境部署

**使用PM2管理进程：**
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name mysql-binlog-analyzer

# 设置开机自启
pm2 startup
pm2 save

# 管理命令
pm2 status                    # 查看状态
pm2 logs mysql-binlog-analyzer # 查看日志
pm2 restart mysql-binlog-analyzer # 重启应用
```

**Nginx反向代理配置：**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10G;  # 支持大文件上传
    }
}
```

## 📖 使用说明

### 基本操作流程

1. **📤 上传文件** - 拖拽或点击上传binlog文件
2. **⏳ 等待解析** - 系统自动解析并显示进度
3. **📊 查看统计** - 浏览操作类型和数量统计
4. **🔍 筛选数据** - 使用多种条件筛选操作记录
5. **👁️ 查看详情** - 点击查看按钮查看SQL详情和字段变更
6. **📋 复制SQL** - 一键复制原始SQL或回滚SQL

### 高级功能

**时间筛选：**
- 支持精确到秒的时间范围筛选
- 提供快捷时间范围选择（最近1小时、6小时、今天等）
- 智能时间格式识别和转换

**SQL差异对比：**
- 自动高亮显示字段变更
- 绿色标识新值，红色标识旧值
- 支持复杂数据类型的差异展示

**批量操作：**
- 支持批量复制SQL语句
- 提供操作统计和汇总信息
- 支持按表或数据库分组查看

## 🏗️ 技术架构

### 技术栈
- **后端框架：** Node.js + Express
- **前端技术：** Bootstrap 5 + Vanilla JavaScript
- **数据库：** MySQL 8.0 (可选)
- **解析工具：** mysqlbinlog (MySQL官方工具)
- **容器化：** Docker + Docker Compose

### 系统架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Node.js App   │    │   MySQL DB      │
│                 │    │                 │    │   (Optional)    │
│ • 文件上传      │◄──►│ • 文件解析      │◄──►│ • 数据存储      │
│ • 结果展示      │    │ • SQL生成       │    │ • 查询优化      │
│ • 交互操作      │    │ • 进度推送      │    │ • 事务管理      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   mysqlbinlog   │
                    │                 │
                    │ • 二进制解析    │
                    │ • 格式转换      │
                    │ • 数据提取      │
                    └─────────────────┘
```

### 核心模块

**解析引擎 (server.js)**
- 文件格式检测和预处理
- mysqlbinlog工具调用和输出处理
- 操作记录提取和结构化
- SQL语句生成和优化

**数据管理 (database.js)**
- 数据库连接和配置管理
- 大数据量分页查询
- 会话管理和数据清理
- 统计信息计算

**前端交互 (public/app.js)**
- 文件上传和进度显示
- 实时数据筛选和排序
- SQL差异高亮显示
- 响应式界面适配

## ⚙️ 配置说明

### 环境变量配置

```bash
# .env 文件配置
NODE_ENV=production          # 运行环境
PORT=3000                   # 服务端口
USE_DATABASE=true           # 是否使用数据库存储
DB_HOST=localhost           # 数据库主机
DB_USER=binlog_user         # 数据库用户
DB_PASSWORD=your_password   # 数据库密码
DB_NAME=binlog_analyzer     # 数据库名称
```

### 数据库初始化

```sql
-- 创建数据库和用户
CREATE DATABASE binlog_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'binlog_user'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON binlog_analyzer.* TO 'binlog_user'@'%';
FLUSH PRIVILEGES;
```

### 系统要求

**最低要求：**
- Node.js 14.0+
- 内存 2GB+
- 磁盘空间 1GB+
- MySQL客户端工具

**推荐配置：**
- Node.js 18.0+
- 内存 8GB+
- SSD存储 10GB+
- MySQL 8.0+

## 🔧 开发指南

### 项目结构
```
mysql-binlog-analyzer/
├── server.js              # 主服务器文件
├── database.js            # 数据库管理模块
├── public/                # 前端静态文件
│   ├── index.html         # 主页面
│   ├── app.js            # 前端逻辑
│   └── *.css             # 样式文件
├── test-data/            # 测试数据
├── uploads/              # 文件上传目录
├── docker-compose.yml    # Docker配置
├── Dockerfile           # Docker镜像构建
└── package.json         # 项目依赖
```

### 开发命令
```bash
npm run dev              # 开发模式启动
npm run test            # 运行测试
npm run generate-test   # 生成测试数据
npm run kill-port       # 清理端口占用
```

### 调试模式
```bash
# 启用调试输出
DEBUG=true npm start

# 查看详细解析过程
NODE_ENV=development npm start
```

## 🛡️ 安全建议

### 生产环境安全
- 🔐 配置防火墙限制访问端口
- 🔑 使用Nginx基础认证或OAuth
- 📁 定期清理uploads临时目录
- 🔄 配置数据库定期备份
- 📊 监控系统资源使用情况

### 文件安全
- 📝 限制上传文件类型和大小
- 🗂️ 自动清理过期临时文件
- 🔍 文件内容安全扫描
- 💾 敏感数据脱敏处理

## ❗ 注意事项

### 系统依赖
- ✅ 确保系统已安装MySQL客户端工具 (mysqlbinlog)
- ✅ 检查Node.js版本兼容性 (14.0+)
- ✅ 确保有足够的内存和磁盘空间

### 性能考虑
- 📊 大文件解析可能需要较长时间
- 💾 建议生产环境使用数据库存储
- 🔧 根据服务器配置调整内存限制
- ⚡ 使用SSD存储提升I/O性能

### 兼容性
- 🐧 完全支持Linux和macOS
- 🪟 Windows需要WSL环境
- 🐳 推荐使用Docker部署避免环境问题

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 贡献流程
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范
- 遵循ESLint代码规范
- 添加必要的注释和文档
- 确保测试用例通过
- 更新相关文档

## 📄 更新日志

### v1.0.0 (2024-12-01)
- ✨ 初始版本发布
- 🚀 支持基本binlog解析功能
- 🎨 实现Web界面和交互
- 🐳 添加Docker部署支持

### 最新更新
- 🔧 修复时间戳解析问题
- 🎯 优化高亮显示算法
- ⚡ 提升大文件处理性能
- 📱 改进移动端适配

## 📞 支持与反馈

- 🐛 **Bug报告：** [GitHub Issues](https://github.com/jichenghan800/mysql-binlog-analyzer/issues)
- 💡 **功能建议：** [GitHub Discussions](https://github.com/jichenghan800/mysql-binlog-analyzer/discussions)
- 📧 **联系邮箱：** your-email@example.com

## 📜 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给个Star支持一下！**

Made with ❤️ by [jichenghan800](https://github.com/jichenghan800)

</div>