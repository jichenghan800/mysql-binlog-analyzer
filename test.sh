#!/bin/bash

# 测试 MySQL Binlog 分析工具

echo "🧪 开始测试 MySQL Binlog 分析工具..."

# 检查服务是否运行
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 服务器未运行，请先启动服务"
    exit 1
fi

echo "✅ 服务器运行正常"

# 检查测试文件
if [ ! -f "test-data/test-binlog.log" ]; then
    echo "📁 生成测试文件..."
    npm run generate-test
fi

echo "✅ 测试文件存在"

# 测试文件上传API
echo "🔄 测试文件上传功能..."
response=$(curl -s -X POST -F "binlogFile=@test-data/test-binlog.log" http://localhost:3000/upload)

if echo "$response" | grep -q '"success":true'; then
    echo "✅ 文件上传和解析成功"
    
    # 提取操作数量
    operations_count=$(echo "$response" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo "📊 解析到 $operations_count 个操作"
    
    # 检查是否包含SQL语句
    if echo "$response" | grep -q '"originalSQL"'; then
        echo "✅ 原始SQL生成成功"
    else
        echo "⚠️  原始SQL生成失败"
    fi
    
    if echo "$response" | grep -q '"reverseSQL"'; then
        echo "✅ 回滚SQL生成成功"
    else
        echo "⚠️  回滚SQL生成失败"
    fi
    
else
    echo "❌ 文件上传失败"
    echo "错误信息: $response"
    exit 1
fi

echo ""
echo "🎉 测试完成！"
echo "🌐 访问 http://localhost:3000 开始使用"
echo "📁 上传 test-data/test-binlog.log 文件进行测试"