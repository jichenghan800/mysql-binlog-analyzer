#!/bin/bash

# 监控服务器日志

echo "📊 监控MySQL Binlog分析工具日志..."
echo "请在浏览器中上传binlog文件，这里会显示解析过程"
echo "按 Ctrl+C 停止监控"
echo "================================"

# 获取当前进程ID
PID=$(pgrep -f "node server.js")

if [ -z "$PID" ]; then
    echo "❌ 服务器未运行"
    exit 1
fi

echo "✅ 监控进程 PID: $PID"
echo "🌐 访问地址: http://10.132.60.69:3000/"
echo "================================"

# 监控进程输出（如果可能的话）
# 由于进程在后台运行，我们创建一个简单的状态监控
while true; do
    if ! kill -0 $PID 2>/dev/null; then
        echo "❌ 服务器进程已停止"
        break
    fi
    
    # 检查内存使用
    MEM=$(ps -p $PID -o %mem --no-headers 2>/dev/null | tr -d ' ')
    CPU=$(ps -p $PID -o %cpu --no-headers 2>/dev/null | tr -d ' ')
    
    echo "$(date '+%H:%M:%S') - CPU: ${CPU}%, 内存: ${MEM}%"
    
    sleep 5
done