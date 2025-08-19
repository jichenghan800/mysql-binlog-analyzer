#!/bin/bash

# 查看服务器日志

echo "📊 MySQL Binlog分析工具 - 实时日志"
echo "================================"

if [ ! -f "server.log" ]; then
    echo "❌ 日志文件不存在，请确保服务器正在运行"
    exit 1
fi

echo "🌐 访问地址: http://10.132.60.69:3000/"
echo "📁 上传华为binlog文件后，这里会显示解析过程"
echo "按 Ctrl+C 停止查看"
echo "================================"

# 实时查看日志
tail -f server.log