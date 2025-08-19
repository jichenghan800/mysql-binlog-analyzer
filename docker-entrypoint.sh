#!/bin/bash

# Docker启动脚本 - 优化内存使用

echo "🐳 Docker环境启动中..."

# 检查可用内存
TOTAL_MEM=$(cat /proc/meminfo | grep MemTotal | awk '{print $2}')
TOTAL_MEM_MB=$((TOTAL_MEM / 1024))

echo "📊 系统内存: ${TOTAL_MEM_MB}MB"

# 根据内存大小设置Node.js参数
if [ $TOTAL_MEM_MB -lt 1024 ]; then
    echo "⚠️  内存不足1GB，使用保守配置"
    export NODE_OPTIONS="--max-old-space-size=512"
elif [ $TOTAL_MEM_MB -lt 2048 ]; then
    echo "📈 内存1-2GB，使用标准配置"
    export NODE_OPTIONS="--max-old-space-size=1024"
elif [ $TOTAL_MEM_MB -lt 8192 ]; then
    echo "🚀 内存2-8GB，使用高性能配置"
    export NODE_OPTIONS="--max-old-space-size=4096"
elif [ $TOTAL_MEM_MB -lt 32768 ]; then
    echo "💪 内存8-32GB，使用超高性能配置"
    export NODE_OPTIONS="--max-old-space-size=16384"
else
    echo "🔥 内存32GB+，使用极限性能配置"
    export NODE_OPTIONS="--max-old-space-size=32768"
fi

echo "🔧 Node.js配置: $NODE_OPTIONS"

# 启动应用
exec node server.js