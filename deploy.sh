#!/bin/bash

# MySQL Binlog Analyzer - Linux 一键部署脚本
# 支持 Ubuntu/Debian/CentOS/RHEL

set -e

echo "🚀 MySQL Binlog Analyzer - Linux 一键部署脚本"
echo "=============================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    log_info "检测到操作系统: $OS $VER"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "检测到root用户，建议使用普通用户运行"
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 安装Node.js
install_nodejs() {
    log_info "检查Node.js安装状态..."
    
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        log_success "Node.js已安装: $NODE_VERSION"
        
        # 检查版本是否满足要求 (>= 14)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 14 ]; then
            log_warning "Node.js版本过低，需要升级到14+版本"
            INSTALL_NODE=true
        else
            INSTALL_NODE=false
        fi
    else
        log_info "Node.js未安装，开始安装..."
        INSTALL_NODE=true
    fi
    
    if [ "$INSTALL_NODE" = true ]; then
        # 使用NodeSource官方脚本安装最新LTS版本
        log_info "安装Node.js LTS版本..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        
        if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
            sudo apt-get install -y nodejs
        elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
            sudo yum install -y nodejs npm
        else
            log_error "不支持的操作系统，请手动安装Node.js 14+"
            exit 1
        fi
        
        log_success "Node.js安装完成: $(node --version)"
    fi
}

# 安装MySQL客户端
install_mysql_client() {
    log_info "检查MySQL客户端安装状态..."
    
    if command -v mysqlbinlog >/dev/null 2>&1; then
        log_success "MySQL客户端已安装"
        return
    fi
    
    log_info "安装MySQL客户端..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        sudo apt-get update
        sudo apt-get install -y mysql-client
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        sudo yum install -y mysql
    else
        log_warning "无法自动安装MySQL客户端，请手动安装"
        log_info "Ubuntu/Debian: sudo apt-get install mysql-client"
        log_info "CentOS/RHEL: sudo yum install mysql"
    fi
    
    if command -v mysqlbinlog >/dev/null 2>&1; then
        log_success "MySQL客户端安装完成"
    else
        log_error "MySQL客户端安装失败，请手动安装"
        exit 1
    fi
}

# 安装PM2 (可选)
install_pm2() {
    log_info "检查PM2安装状态..."
    
    if command -v pm2 >/dev/null 2>&1; then
        log_success "PM2已安装"
        return
    fi
    
    read -p "是否安装PM2进程管理器? (推荐) (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        return
    fi
    
    log_info "安装PM2..."
    sudo npm install -g pm2
    
    if command -v pm2 >/dev/null 2>&1; then
        log_success "PM2安装完成"
        
        # 设置PM2开机自启
        read -p "是否设置PM2开机自启? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            pm2 startup
            log_info "请按照上面的提示执行命令以完成开机自启设置"
        fi
    else
        log_warning "PM2安装失败，将使用普通方式启动"
    fi
}

# 克隆或更新项目
setup_project() {
    PROJECT_DIR="mysql-binlog-analyzer"
    
    if [ -d "$PROJECT_DIR" ]; then
        log_info "项目目录已存在，更新代码..."
        cd "$PROJECT_DIR"
        git pull origin main
    else
        log_info "克隆项目代码..."
        git clone https://github.com/jichenghan800/mysql-binlog-analyzer.git
        cd "$PROJECT_DIR"
    fi
    
    log_success "项目代码准备完成"
}

# 安装项目依赖
install_dependencies() {
    log_info "安装项目依赖..."
    npm install --production
    log_success "依赖安装完成"
}

# 配置环境
setup_environment() {
    log_info "配置环境变量..."
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        log_info "已创建.env配置文件"
        
        # 询问是否配置数据库
        read -p "是否配置MySQL数据库支持? (用于大文件处理) (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "数据库主机 (默认: localhost): " DB_HOST
            DB_HOST=${DB_HOST:-localhost}
            
            read -p "数据库用户名 (默认: root): " DB_USER
            DB_USER=${DB_USER:-root}
            
            read -s -p "数据库密码: " DB_PASSWORD
            echo
            
            read -p "数据库名称 (默认: binlog_analyzer): " DB_NAME
            DB_NAME=${DB_NAME:-binlog_analyzer}
            
            # 更新.env文件
            sed -i "s/USE_DATABASE=false/USE_DATABASE=true/" .env
            sed -i "s/DB_HOST=localhost/DB_HOST=$DB_HOST/" .env
            sed -i "s/DB_USER=root/DB_USER=$DB_USER/" .env
            sed -i "s/DB_PASSWORD=/DB_PASSWORD=$DB_PASSWORD/" .env
            sed -i "s/DB_NAME=binlog_analyzer/DB_NAME=$DB_NAME/" .env
            
            log_success "数据库配置完成"
        fi
    else
        log_info ".env文件已存在，跳过配置"
    fi
}

# 配置防火墙
setup_firewall() {
    read -p "是否配置防火墙开放3000端口? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        return
    fi
    
    log_info "配置防火墙..."
    
    # 检测防火墙类型
    if command -v ufw >/dev/null 2>&1; then
        sudo ufw allow 3000
        log_success "UFW防火墙配置完成"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        sudo firewall-cmd --permanent --add-port=3000/tcp
        sudo firewall-cmd --reload
        log_success "Firewalld防火墙配置完成"
    elif command -v iptables >/dev/null 2>&1; then
        sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
        log_warning "iptables规则已添加，但可能需要手动保存"
    else
        log_warning "未检测到防火墙，请手动开放3000端口"
    fi
}

# 启动服务
start_service() {
    log_info "启动服务..."
    
    if command -v pm2 >/dev/null 2>&1; then
        # 使用PM2启动
        pm2 start server.js --name "mysql-binlog-analyzer"
        pm2 save
        log_success "服务已通过PM2启动"
        log_info "PM2管理命令:"
        log_info "  查看状态: pm2 status"
        log_info "  查看日志: pm2 logs mysql-binlog-analyzer"
        log_info "  重启服务: pm2 restart mysql-binlog-analyzer"
        log_info "  停止服务: pm2 stop mysql-binlog-analyzer"
    else
        # 使用nohup后台启动
        nohup node server.js > server.log 2>&1 &
        SERVER_PID=$!
        echo $SERVER_PID > server.pid
        log_success "服务已后台启动 (PID: $SERVER_PID)"
        log_info "查看日志: tail -f server.log"
        log_info "停止服务: kill \$(cat server.pid)"
    fi
    
    sleep 3
    
    # 检查服务状态
    if curl -s http://localhost:3000 >/dev/null; then
        log_success "服务启动成功！"
    else
        log_error "服务启动失败，请检查日志"
        exit 1
    fi
}

# 显示访问信息
show_access_info() {
    echo
    echo "🎉 部署完成！"
    echo "=============="
    
    # 获取服务器IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo "📍 访问地址:"
    echo "  本地访问: http://localhost:3000"
    if [ ! -z "$SERVER_IP" ]; then
        echo "  外网访问: http://$SERVER_IP:3000"
    fi
    
    echo
    echo "📁 项目目录: $(pwd)"
    echo "📋 配置文件: .env"
    echo "📊 测试文件: test-data/test-binlog.log"
    
    echo
    echo "🔧 常用命令:"
    if command -v pm2 >/dev/null 2>&1; then
        echo "  查看状态: pm2 status"
        echo "  查看日志: pm2 logs mysql-binlog-analyzer"
        echo "  重启服务: pm2 restart mysql-binlog-analyzer"
    else
        echo "  查看日志: tail -f server.log"
        echo "  停止服务: kill \$(cat server.pid)"
    fi
    
    echo
    echo "📖 使用说明: https://github.com/jichenghan800/mysql-binlog-analyzer"
}

# 主函数
main() {
    echo
    detect_os
    check_root
    
    echo
    log_info "开始安装依赖..."
    install_nodejs
    install_mysql_client
    install_pm2
    
    echo
    log_info "设置项目..."
    setup_project
    install_dependencies
    setup_environment
    
    echo
    setup_firewall
    start_service
    show_access_info
    
    echo
    log_success "🎉 MySQL Binlog Analyzer 部署完成！"
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查上面的错误信息"; exit 1' ERR

# 执行主函数
main "$@"