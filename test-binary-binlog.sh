#!/bin/bash

# 测试mysqlbinlog工具的输出格式
echo "测试mysqlbinlog工具..."

# 检查mysqlbinlog是否可用
if ! command -v mysqlbinlog &> /dev/null; then
    echo "mysqlbinlog工具未安装"
    exit 1
fi

# 创建一个测试用的二进制binlog文件（如果有的话）
echo "当前目录中的binlog文件："
find . -name "*.log" -o -name "*bin*" | head -5

echo ""
echo "如果你有真实的binlog文件，请将其放在当前目录，然后运行："
echo "mysqlbinlog -v --base64-output=DECODE-ROWS --start-datetime='1970-01-01 00:00:00' your-binlog-file"