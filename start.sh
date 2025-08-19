#!/bin/bash

# MySQL Binlog 分析工具启动脚本

echo "🔧 检查依赖..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 npm"
    exit 1
fi

echo "📦 检查项目依赖..."
if [ ! -d "node_modules" ]; then
    echo "📥 安装依赖包..."
    npm install
fi

echo "🧹 清理旧进程..."
npm run kill-port > /dev/null 2>&1

echo "📁 生成测试数据..."
npm run generate-test

echo "🚀 启动服务器..."
npm start &

# 等待服务器启动
sleep 3

# 检查服务器是否启动成功
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 服务器启动成功！"
    echo "📍 本地访问: http://localhost:3000"
    
    # 获取局域网IP
    LOCAL_IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.' | head -3)
    if [ ! -z "$LOCAL_IPS" ]; then
        echo "🌐 局域网访问:"
        echo "$LOCAL_IPS" | while read ip; do
            echo "   http://$ip:3000"
        done
    fi
    
    echo "📁 测试文件: test-data/test-binlog.log"
    echo ""
    echo "💡 使用说明:"
    echo "   - 上传 test-data/test-binlog.log 文件进行测试"
    echo "   - 点击'原始'按钮查看重构的SQL语句"
    echo "   - 点击'回滚'按钮查看回滚SQL语句"
    echo "   - 使用筛选功能分析特定操作"
    echo ""
    echo "⏹️  停止服务: npm run stop"
else
    echo "❌ 服务器启动失败，请检查日志"
    exit 1
fi