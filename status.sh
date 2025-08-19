#!/bin/bash

# 检查服务状态

echo "🔍 检查 MySQL Binlog 分析工具状态..."

# 检查端口3000是否被占用
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ 服务器正在运行"
    echo "📍 本地访问: http://localhost:3000"
    
    # 获取局域网IP
    LOCAL_IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.' | head -3)
    if [ ! -z "$LOCAL_IPS" ]; then
        echo "🌐 局域网访问:"
        echo "$LOCAL_IPS" | while read ip; do
            echo "   http://$ip:3000"
        done
    fi
    
    # 检查服务是否响应
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ 服务响应正常"
    else
        echo "⚠️  服务无响应"
    fi
    
    # 显示进程信息
    echo "📊 进程信息:"
    ps aux | grep "node server.js" | grep -v grep
    
else
    echo "❌ 服务器未运行"
    echo "💡 启动服务: npm start 或 ./start.sh"
fi

# 检查测试文件
if [ -f "test-data/test-binlog.log" ]; then
    echo "✅ 测试文件存在: test-data/test-binlog.log"
else
    echo "⚠️  测试文件不存在，运行: npm run generate-test"
fi