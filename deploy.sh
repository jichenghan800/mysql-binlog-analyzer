#!/bin/bash

# MySQL Binlog Analyzer 部署脚本

echo "🚀 MySQL Binlog Analyzer 部署脚本"
echo "=================================="

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 npm"
    exit 1
fi

# 检查mysqlbinlog
if ! command -v mysqlbinlog &> /dev/null; then
    echo "⚠️  mysqlbinlog 未安装，将无法解析二进制binlog文件"
    echo "   请安装 MySQL 客户端工具"
fi

echo "📦 安装依赖..."
npm install

echo "🧹 清理旧文件..."
rm -rf uploads/*.log uploads/*.bin uploads/mysql-bin.* 2>/dev/null || true

echo "🔧 设置权限..."
chmod +x *.sh

echo "✅ 部署完成！"
echo ""
echo "🌐 启动命令:"
echo "   npm start"
echo ""
echo "📍 访问地址:"
echo "   http://localhost:3000"
echo ""
echo "📁 测试文件:"
echo "   test-data/test-binlog.log"