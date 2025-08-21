#!/bin/bash

# MySQL Binlog Analyzer - 一键部署脚本
# 自动处理目录创建、环境检查、代码下载和服务启动

set -e

echo "🚀 MySQL Binlog Analyzer - 一键部署脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 1. 环境检查和准备
log_info "步骤1: 环境检查和准备..."

# 检查是否为root用户或有sudo权限
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    log_error "需要root权限或sudo权限来执行此脚本"
    echo "请使用以下方式之一运行："
    echo "  sudo $0"
    echo "  或确保当前用户有sudo权限"
    exit 1
fi

# 检查操作系统
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    log_info "检测到Linux系统"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    log_info "检测到macOS系统"
else
    log_error "不支持的操作系统: $OSTYPE"
    exit 1
fi

# 2. 安装基础依赖
log_info "步骤2: 安装基础依赖..."

if [ "$OS" = "linux" ]; then
    # 更新包管理器
    if command -v apt-get >/dev/null 2>&1; then
        log_info "使用apt-get更新软件包..."
        sudo apt-get update -qq
        sudo apt-get install -y curl wget git
    elif command -v yum >/dev/null 2>&1; then
        log_info "使用yum更新软件包..."
        sudo yum update -y -q
        sudo yum install -y curl wget git
    elif command -v dnf >/dev/null 2>&1; then
        log_info "使用dnf更新软件包..."
        sudo dnf update -y -q
        sudo dnf install -y curl wget git
    else
        log_error "不支持的Linux发行版"
        exit 1
    fi
elif [ "$OS" = "macos" ]; then
    # 检查Homebrew
    if ! command -v brew >/dev/null 2>&1; then
        log_info "安装Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install curl wget git
fi

log_success "基础依赖安装完成"

# 3. 安装Docker和Docker Compose
log_info "步骤3: 检查并安装Docker..."

if ! command -v docker >/dev/null 2>&1; then
    log_info "Docker未安装，开始安装..."
    
    if [ "$OS" = "linux" ]; then
        # 安装Docker
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh
        
        # 启动Docker服务
        sudo systemctl start docker
        sudo systemctl enable docker
        
        # 添加当前用户到docker组
        sudo usermod -aG docker $USER
        
        log_warning "Docker已安装，请重新登录或运行 'newgrp docker' 以使用Docker"
    elif [ "$OS" = "macos" ]; then
        log_error "请手动安装Docker Desktop for Mac: https://docs.docker.com/docker-for-mac/install/"
        exit 1
    fi
else
    log_success "Docker已安装"
fi

# 检查Docker Compose
if ! command -v docker-compose >/dev/null 2>&1; then
    log_info "Docker Compose未安装，开始安装..."
    
    if [ "$OS" = "linux" ]; then
        # 安装Docker Compose
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    elif [ "$OS" = "macos" ]; then
        brew install docker-compose
    fi
else
    log_success "Docker Compose已安装"
fi

# 4. 创建工作目录
log_info "步骤4: 创建工作目录..."

# 默认使用用户主目录，更安全且不需要特殊权限
WORK_DIR="$HOME"
log_info "使用$HOME作为工作目录"

cd "$WORK_DIR"

# 清理旧安装
if [ -d "mysql-binlog-analyzer" ]; then
    log_warning "发现旧安装，正在清理..."
    
    # 停止旧服务
    cd mysql-binlog-analyzer
    docker-compose --profile memory-only down --remove-orphans 2>/dev/null || true
    docker-compose --profile with-database down --remove-orphans 2>/dev/null || true
    docker-compose down --remove-orphans 2>/dev/null || true
    cd ..
    
    # 删除旧目录
    rm -rf mysql-binlog-analyzer
fi

log_success "工作目录准备完成: $WORK_DIR"

# 5. 下载部署脚本并执行
log_info "步骤5: 下载并执行Docker部署脚本..."

# 下载部署脚本
log_info "下载部署脚本..."
if ! wget -O deploy-docker.sh https://raw.githubusercontent.com/jichenghan800/mysql-binlog-analyzer/main/deploy-docker.sh; then
    log_error "下载部署脚本失败，请检查网络连接"
    exit 1
fi

# 设置执行权限
chmod +x deploy-docker.sh

# 执行部署脚本
log_info "执行Docker部署脚本..."
./deploy-docker.sh

# 6. 设置防火墙规则（如果需要）
log_info "步骤6: 配置防火墙..."

if [ "$OS" = "linux" ]; then
    # 检查防火墙状态
    if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
        log_info "配置UFW防火墙规则..."
        sudo ufw allow 5000/tcp
        sudo ufw reload
    elif command -v firewall-cmd >/dev/null 2>&1 && sudo firewall-cmd --state >/dev/null 2>&1; then
        log_info "配置firewalld防火墙规则..."
        sudo firewall-cmd --permanent --add-port=5000/tcp
        sudo firewall-cmd --reload
    elif command -v iptables >/dev/null 2>&1; then
        log_info "配置iptables防火墙规则..."
        sudo iptables -A INPUT -p tcp --dport 5000 -j ACCEPT
        # 尝试保存规则
        sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    fi
fi

log_success "防火墙配置完成"

# 7. 创建管理脚本
log_info "步骤7: 创建管理脚本..."

cd "$WORK_DIR/mysql-binlog-analyzer"

# 创建启动脚本
cat > start.sh << 'EOF'
#!/bin/bash
echo "启动MySQL Binlog Analyzer..."
echo "1) 内存存储模式"
echo "2) 数据库存储模式"
read -p "请选择模式 (1/2): " choice

case $choice in
    1)
        docker-compose --profile memory-only up -d
        ;;
    2)
        docker-compose --profile with-database up -d
        ;;
    *)
        echo "默认启动数据库存储模式..."
        docker-compose --profile with-database up -d
        ;;
esac

echo "服务启动完成！"
echo "访问地址: http://localhost:5000"
EOF

# 创建停止脚本
cat > stop.sh << 'EOF'
#!/bin/bash
echo "停止MySQL Binlog Analyzer..."
docker-compose --profile memory-only down 2>/dev/null || true
docker-compose --profile with-database down 2>/dev/null || true
docker-compose down 2>/dev/null || true
echo "服务已停止"
EOF

# 创建状态检查脚本
cat > status.sh << 'EOF'
#!/bin/bash
echo "=== 服务状态 ==="
docker-compose ps

echo ""
echo "=== 最近日志 ==="
docker-compose logs --tail 10

echo ""
echo "=== 访问地址 ==="
echo "本地访问: http://localhost:5000"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')
if [ ! -z "$SERVER_IP" ]; then
    echo "外网访问: http://$SERVER_IP:5000"
fi
EOF

# 设置执行权限
chmod +x start.sh stop.sh status.sh

log_success "管理脚本创建完成"

# 8. 最终检查和信息显示
log_info "步骤8: 最终检查..."

# 等待服务完全启动
sleep 10

# 检查服务状态
if curl -s http://localhost:5000 >/dev/null 2>&1; then
    SERVICE_STATUS="✅ 运行正常"
else
    SERVICE_STATUS="⚠️ 可能还在启动中"
fi

# 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "🎉 MySQL Binlog Analyzer 一键部署完成！"
echo "============================================="
echo ""
echo "📍 安装位置: $WORK_DIR/mysql-binlog-analyzer"
echo "📊 服务状态: $SERVICE_STATUS"
echo ""
echo "🌐 访问地址:"
echo "  本地访问: http://localhost:5000"
if [ ! -z "$SERVER_IP" ]; then
    echo "  外网访问: http://$SERVER_IP:5000"
fi
echo ""
echo "🔧 管理命令:"
echo "  启动服务: cd $WORK_DIR/mysql-binlog-analyzer && ./start.sh"
echo "  停止服务: cd $WORK_DIR/mysql-binlog-analyzer && ./stop.sh"
echo "  查看状态: cd $WORK_DIR/mysql-binlog-analyzer && ./status.sh"
echo "  查看日志: cd $WORK_DIR/mysql-binlog-analyzer && docker-compose logs -f"
echo ""
echo "📖 使用说明:"
echo "  1. 打开浏览器访问上述地址"
echo "  2. 上传MySQL binlog文件"
echo "  3. 查看解析结果和SQL语句"
echo ""
echo "🆘 故障排查:"
echo "  如果无法访问，请检查："
echo "  - 防火墙设置: sudo ufw status"
echo "  - 服务状态: docker-compose ps"
echo "  - 应用日志: docker-compose logs"
echo ""

log_success "🎉 部署完成！请访问 http://localhost:5000 开始使用"