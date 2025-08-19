#!/bin/bash

# MySQL Binlog 分析工具演示脚本

echo "🎬 MySQL Binlog 分析工具演示"
echo "================================"

# 启动服务
echo "🚀 启动服务..."
./start.sh > /dev/null 2>&1 &
sleep 5

# 运行测试
echo "🧪 运行功能测试..."
./test.sh

echo ""
echo "📋 演示功能列表:"
echo "1. 📁 文件上传 - 支持拖拽上传binlog文件"
echo "2. 🔍 智能解析 - 自动识别INSERT、UPDATE、DELETE操作"
echo "3. 📊 统计分析 - 实时统计各类操作数量"
echo "4. 🔧 筛选排序 - 按类型、数据库、表名筛选"
echo "5. 🔄 SQL生成 - 自动生成原始SQL和回滚SQL"
echo "6. 📋 一键复制 - 复制SQL到剪贴板"
echo "7. 💡 详情查看 - 查看操作的完整信息"

echo ""
echo "🎯 演示步骤:"
echo "1. 访问 http://localhost:3000"
echo "2. 上传 test-data/test-binlog.log 文件"
echo "3. 查看解析结果和统计信息"
echo "4. 点击'原始'按钮查看重构的SQL语句"
echo "5. 点击'回滚'按钮查看回滚SQL语句"
echo "6. 使用筛选功能分析特定操作"
echo "7. 点击'查看详情'了解操作上下文"

echo ""
echo "📝 测试数据说明:"
echo "- test_db.users: 用户表操作（INSERT + UPDATE）"
echo "- test_db.orders: 订单表操作（INSERT + DELETE）"
echo "- shop_db.products: 商品表操作（INSERT）"

echo ""
echo "🌟 核心特性展示:"
echo "- 原始SQL: 重构当时执行的SQL语句"
echo "- 回滚SQL: 用于数据回滚的SQL语句"
echo "- 实时筛选: 按操作类型、数据库、表名筛选"
echo "- 统计分析: 操作数量和分布统计"

echo ""
echo "🎉 演示准备完成！请访问 http://localhost:3000 开始体验"