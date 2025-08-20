#!/bin/bash

# MySQL Binlog Analyzer - Docker 完整部署脚本
# 适用于全新部署或重新部署

set -e

echo "🚀 MySQL Binlog Analyzer - Docker 完整部署脚本"
echo "=================================================="

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

# 1. 环境检查
log_info "步骤1: 检查环境依赖..."

# 检查Docker
if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose
if ! command -v docker-compose >/dev/null 2>&1; then
    log_error "Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 检查Git
if ! command -v git >/dev/null 2>&1; then
    log_error "Git未安装，请先安装Git"
    exit 1
fi

log_success "环境检查通过"

# 2. 清理旧环境
log_info "步骤2: 清理旧环境..."

# 停止并删除所有相关容器
log_info "停止所有相关容器..."
docker ps -a | grep mysql-binlog-analyzer | awk '{print $1}' | xargs docker stop 2>/dev/null || true
docker ps -a | grep mysql-binlog-analyzer | awk '{print $1}' | xargs docker rm -f 2>/dev/null || true

# 停止并删除旧容器
if [ -d "mysql-binlog-analyzer" ]; then
    cd mysql-binlog-analyzer
    docker-compose --profile memory-only down --remove-orphans 2>/dev/null || true
    docker-compose --profile with-database down --remove-orphans 2>/dev/null || true
    docker-compose down --remove-orphans 2>/dev/null || true
    cd ..
fi

# 删除旧项目目录
if [ -d "mysql-binlog-analyzer" ]; then
    log_warning "删除旧项目目录..."
    rm -rf mysql-binlog-analyzer
fi

# 清理Docker资源
log_info "清理Docker资源..."
docker system prune -f >/dev/null 2>&1 || true
docker builder prune -f >/dev/null 2>&1 || true

# 删除相关镜像
docker images | grep mysql-binlog-analyzer | awk '{print $3}' | xargs docker rmi -f 2>/dev/null || true

log_success "旧环境清理完成"

# 3. 克隆最新代码
log_info "步骤3: 克隆最新代码..."

git clone https://github.com/jichenghan800/mysql-binlog-analyzer.git
cd mysql-binlog-analyzer

log_success "代码克隆完成"

# 4. 检查关键文件
log_info "步骤4: 检查关键文件..."

# 检查Dockerfile
if [ ! -f "Dockerfile" ]; then
    log_error "Dockerfile不存在"
    exit 1
fi

# 检查docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    log_error "docker-compose.yml不存在"
    exit 1
fi

# 检查server.js
if [ ! -f "server.js" ]; then
    log_error "server.js不存在"
    exit 1
fi

# 检查package.json
if [ ! -f "package.json" ]; then
    log_error "package.json不存在"
    exit 1
fi

log_success "关键文件检查通过"

# 5. 显示文件内容（调试用）
log_info "步骤5: 显示关键配置..."

echo "=== Dockerfile 内容 ==="
cat Dockerfile
echo ""

echo "=== docker-compose.yml 服务配置 ==="
grep -A 20 "services:" docker-compose.yml
echo ""

# 6. 选择部署模式
log_info "步骤6: 选择部署模式..."

echo ""
echo "==========================================="
echo "🚀 选择部署模式"
echo "==========================================="
echo ""
echo "请选择启动模式："
echo "1) 内存存储模式 (适合小文件测试，端口5000)"
echo "2) 数据库存储模式 (适合大文件生产环境，端口5000)"
echo ""
echo "请输入选择 (1 或 2)，10秒内无输入将自动选择数据库模式(2): "

# 使用timeout命令实现10秒超时
if timeout 10 bash -c 'read choice < /dev/tty && echo $choice' 2>/dev/null; then
    choice=$(timeout 10 bash -c 'read choice < /dev/tty && echo $choice' 2>/dev/null)
    echo "您选择了: $choice"
else
    choice="2"
    echo ""
    log_warning "10秒内无输入，自动选择数据库存储模式(2)"
fi

# 根据选择设置变量
case $choice in
    1)
        SERVICE_NAME="app"
        BUILD_TARGET="app"
        PROFILE_FLAG="--profile memory-only"
        CHECK_PORT=5000
        ;;
    2)
        SERVICE_NAME="mysql-binlog-analyzer-db"
        BUILD_TARGET="mysql-binlog-analyzer-db mysql"
        PROFILE_FLAG="--profile with-database"
        CHECK_PORT=5000
        ;;
    *)
        log_warning "无效选择，默认使用数据库存储模式"
        choice="2"
        SERVICE_NAME="mysql-binlog-analyzer-db"
        BUILD_TARGET="mysql-binlog-analyzer-db mysql"
        PROFILE_FLAG="--profile with-database"
        CHECK_PORT=5000
        ;;
esac

log_success "部署模式选择完成: $SERVICE_NAME"

# 7. 检查端口占用
log_info "步骤7: 检查端口占用..."

# 强制清理端口占用
log_info "清理端口占用..."
if netstat -tlnp | grep :$CHECK_PORT >/dev/null 2>&1; then
    log_warning "端口$CHECK_PORT被占用，强制释放..."
    sudo fuser -k $CHECK_PORT/tcp 2>/dev/null || true
    sleep 3
    # 再次检查
    if netstat -tlnp | grep :$CHECK_PORT >/dev/null 2>&1; then
        log_error "端口$CHECK_PORT仍被占用，请手动检查"
        netstat -tlnp | grep :$CHECK_PORT
        exit 1
    fi
fi

if [ "$choice" = "2" ] && netstat -tlnp | grep :3306 >/dev/null 2>&1; then
    log_warning "端口3306被占用，强制释放..."
    sudo fuser -k 3306/tcp 2>/dev/null || true
    sleep 3
fi

log_success "端口检查完成"

# 8. 构建镜像
log_info "步骤8: 构建Docker镜像..."

# 彻底清理构建缓存和中间层
log_info "清理Docker缓存..."
docker system prune -a -f
docker builder prune -a -f

# 删除所有相关镜像（包括中间层）
log_info "删除旧镜像..."
docker images -a | grep mysql-binlog-analyzer | awk '{print $3}' | xargs docker rmi -f 2>/dev/null || true
docker images -a | grep "<none>" | awk '{print $3}' | xargs docker rmi -f 2>/dev/null || true

# 显示剩余镜像
log_info "当前镜像列表:"
docker images

# 根据选择构建对应服务
log_info "开始构建镜像（只构建选择的服务）..."
echo "=== Docker构建输出 ==="
if [ "$choice" = "1" ]; then
    log_info "构建内存存储模式服务..."
    if ! docker-compose $PROFILE_FLAG build --no-cache --pull --force-rm; then
        log_error "构建失败！请检查上面的错误信息"
        exit 1
    fi
else
    log_info "构建数据库存储模式服务..."
    if ! docker-compose $PROFILE_FLAG build --no-cache --pull --force-rm; then
        log_error "构建失败！请检查上面的错误信息"
        exit 1
    fi
fi
echo "=== 构建完成 ==="

log_success "镜像构建完成"

# 验证镜像构建结果
log_info "验证镜像构建结果..."
if ! docker images | grep mysql-binlog-analyzer; then
    log_error "未找到构建的镜像！构建可能失败"
    echo "当前所有镜像:"
    docker images
    exit 1
fi

# 9. 启动服务
log_info "步骤9: 启动服务..."

case $choice in
    1)
        log_info "启动内存存储模式..."
        docker-compose --profile memory-only up -d
        ;;
    2)
        log_info "启动数据库存储模式..."
        docker-compose --profile with-database up -d
        ;;
esac

log_success "服务启动完成"

# 10. 等待服务就绪
log_info "步骤10: 等待服务就绪..."

sleep 5

# 11. 检查服务状态
log_info "步骤11: 检查服务状态..."

echo "=== 容器状态 ==="
docker-compose ps

echo ""
echo "=== 应用日志 (最近20行) ==="
if [ "$SERVICE_NAME" = "app" ]; then
    docker logs --tail 20 mysql-binlog-analyzer-app-1 2>/dev/null || docker logs --tail 20 $(docker ps -q --filter "name=app")
else
    docker logs --tail 20 mysql-binlog-analyzer-mysql-binlog-analyzer-db-1 2>/dev/null || docker logs --tail 20 $(docker ps -q --filter "name=mysql-binlog-analyzer-db")
fi

echo ""

# 12. 获取访问地址
log_info "步骤12: 获取访问信息..."

# 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "🎉 部署完成！"
echo "=============="
echo "📍 访问地址:"
echo "  本地访问: http://localhost:$CHECK_PORT"
if [ ! -z "$SERVER_IP" ]; then
    echo "  外网访问: http://$SERVER_IP:$CHECK_PORT"
fi

echo ""
echo "📋 管理命令:"
echo "  查看状态: docker-compose ps"
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"

echo ""
echo "🔧 故障排查:"
echo "  应用日志: docker logs -f mysql-binlog-analyzer-${SERVICE_NAME}-1"
if [ "$choice" = "2" ]; then
    echo "  数据库日志: docker logs -f mysql-binlog-analyzer-mysql-1"
fi
echo "  进入容器: docker exec -it mysql-binlog-analyzer-${SERVICE_NAME}-1 sh"

echo ""
echo "📖 使用说明:"
echo "  1. 打开浏览器访问上述地址"
echo "  2. 上传binlog文件进行分析"
echo "  3. 查看解析结果和SQL语句"

# 13. 最终检查
log_info "步骤13: 最终健康检查..."

sleep 3

if curl -s http://localhost:$CHECK_PORT >/dev/null 2>&1; then
    log_success "✅ 服务运行正常，可以访问！"
else
    log_warning "⚠️ 服务可能还在启动中，请稍等片刻后访问"
    echo "如果持续无法访问，请检查日志："
    echo "docker logs -f mysql-binlog-analyzer-${SERVICE_NAME}-1"
fi

echo ""
log_success "🎉 MySQL Binlog Analyzer Docker部署完成！"