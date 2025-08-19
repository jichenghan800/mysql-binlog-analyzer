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

### 1. 克隆项目
```bash
git clone https://github.com/jichenghan800/mysql-binlog-analyzer.git
cd mysql-binlog-analyzer
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动服务
```bash
npm start
# 或
node server.js
```

### 4. 访问应用
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

### 🚀 一键部署 (推荐)

**Linux服务器一键部署：**
```bash
# 下载并运行部署脚本
curl -fsSL https://raw.githubusercontent.com/jichenghan800/mysql-binlog-analyzer/main/deploy.sh | bash

# 或者手动下载执行
wget https://raw.githubusercontent.com/jichenghan800/mysql-binlog-analyzer/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

部署脚本会自动：
- ✅ 检测操作系统并安装Node.js
- ✅ 安装MySQL客户端工具
- ✅ 克隆项目代码
- ✅ 安装依赖包
- ✅ 配置环境变量
- ✅ 设置防火墙规则
- ✅ 启动服务 (支持PM2)

### 🐳 Docker部署

**基础部署：**
```bash
# 克隆项目
git clone https://github.com/jichenghan800/mysql-binlog-analyzer.git
cd mysql-binlog-analyzer

# 构建并启动
docker-compose up -d
```

**包含数据库：**
```bash
# 启动应用和MySQL数据库
docker-compose --profile with-database up -d
```

### 📋 手动部署

**系统要求：**
- Node.js 14+
- MySQL客户端工具 (mysqlbinlog)
- Linux/macOS/Windows

**安装步骤：**
```bash
# 1. 克隆项目
git clone https://github.com/jichenghan800/mysql-binlog-analyzer.git
cd mysql-binlog-analyzer

# 2. 安装依赖
npm install

# 3. 配置环境 (可选)
cp .env.example .env
# 编辑.env文件配置数据库等参数

# 4. 启动服务
npm start
# 或使用PM2
pm2 start server.js --name mysql-binlog-analyzer
```

### 🔧 环境配置

**数据库配置 (可选)：**
```bash
# .env文件配置
USE_DATABASE=true
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=binlog_analyzer
```

**MySQL数据库准备：**
```sql
CREATE DATABASE binlog_analyzer;
CREATE USER 'binlog_user'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON binlog_analyzer.* TO 'binlog_user'@'%';
FLUSH PRIVILEGES;
```

### 🌐 生产环境部署

**使用PM2 (推荐)：**
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name mysql-binlog-analyzer

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status                    # 查看状态
pm2 logs mysql-binlog-analyzer # 查看日志
pm2 restart mysql-binlog-analyzer # 重启
pm2 stop mysql-binlog-analyzer    # 停止
```

**使用Systemd：**
```bash
# 创建服务文件
sudo tee /etc/systemd/system/mysql-binlog-analyzer.service > /dev/null <<EOF
[Unit]
Description=MySQL Binlog Analyzer
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/mysql-binlog-analyzer
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable mysql-binlog-analyzer
sudo systemctl start mysql-binlog-analyzer
```

**Nginx反向代理：**
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 🔒 安全建议

- 🔐 使用防火墙限制访问端口
- 🔑 配置Nginx基础认证或其他认证方式
- 📁 定期清理uploads目录
- 🔄 定期备份数据库 (如果使用)
- 📊 监控服务器资源使用情况

### ❗ 注意事项

- 确保系统已安装MySQL客户端工具 (mysqlbinlog)
- 大文件解析可能需要较长时间和更多内存
- 建议在服务器环境下运行以获得更好性能
- 生产环境建议配置数据库存储大文件数据
- Windows用户可运行 `setup-windows-simple.bat` 配置网络转发

## 许可证

MIT License - 开源项目，欢迎贡献和使用