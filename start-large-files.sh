#!/bin/bash

# 大文件处理启动脚本 - 增加内存限制

echo "🚀 启动MySQL Binlog分析工具 (大文件模式)..."

# 检查Node.js版本
NODE_VERSION=$(node --version 2>/dev/null || echo "未安装")
echo "📍 Node.js版本: $NODE_VERSION"

# 检查可用内存
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.1f", $2/1024}')
AVAILABLE_MEM=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
echo "💾 系统内存: ${TOTAL_MEM}GB 总计, ${AVAILABLE_MEM}GB 可用"

# 根据可用内存设置Node.js内存限制
if (( $(echo "$AVAILABLE_MEM > 8" | bc -l) )); then
    MAX_MEMORY=8192
    echo "🔧 设置内存限制: 8GB (高性能模式)"
elif (( $(echo "$AVAILABLE_MEM > 4" | bc -l) )); then
    MAX_MEMORY=4096
    echo "🔧 设置内存限制: 4GB (标准模式)"
elif (( $(echo "$AVAILABLE_MEM > 2" | bc -l) )); then
    MAX_MEMORY=2048
    echo "🔧 设置内存限制: 2GB (节约模式)"
else
    MAX_MEMORY=1024
    echo "⚠️  设置内存限制: 1GB (最小模式)"
    echo "   建议增加系统内存以获得更好性能"
fi

# 清理旧进程
echo "🧹 清理旧进程..."
npm run kill-port > /dev/null 2>&1

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 生成测试数据
if [ ! -f "test-data/test-binlog.log" ]; then
    echo "📁 生成测试数据..."
    npm run generate-test
fi

# 启动服务器
echo "🚀 启动服务器 (内存限制: ${MAX_MEMORY}MB)..."
node --max-old-space-size=$MAX_MEMORY server.js &

# 等待服务器启动
sleep 3

# 检查服务器状态
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 服务器启动成功！"
    echo ""
    echo "📍 访问地址:"
    echo "   本地: http://localhost:3000"
    
    # 获取局域网IP
    LOCAL_IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.' | head -3)
    if [ ! -z "$LOCAL_IPS" ]; then
        echo "   局域网:"
        echo "$LOCAL_IPS" | while read ip; do
            echo "     http://$ip:3000"
        done
    fi
    
    echo ""
    echo "📊 大文件处理能力:"
    echo "   内存限制: ${MAX_MEMORY}MB"
    echo "   最大文件: 500MB"
    echo "   最大操作: 10,000个"
    echo ""
    echo "💡 使用建议:"
    echo "   - 30MB以下文件: 快速处理"
    echo "   - 30-100MB文件: 需要1-5分钟"
    echo "   - 100MB以上文件: 建议分割处理"
    echo ""
    echo "📚 文档:"
    echo "   - 大文件处理: LARGE-FILE-HANDLING.md"
    echo "   - WSL网络配置: WSL-NETWORK-SETUP.md"
    echo ""
    echo "⏹️  停止服务: Ctrl+C 或 npm run stop"
else
    echo "❌ 服务器启动失败"
    echo "请检查端口是否被占用或查看错误日志"
    exit 1
fi