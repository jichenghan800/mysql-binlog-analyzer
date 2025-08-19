#!/bin/bash

# 测试时间显示功能

echo "🕒 测试时间显示功能..."

# 检查服务是否运行
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 服务器未运行，请先启动服务"
    exit 1
fi

# 上传测试文件并获取结果
echo "📤 上传测试文件并检查时间解析..."
response=$(curl -s -X POST -F "binlogFile=@test-data/test-binlog.log" http://localhost:3000/upload)

if echo "$response" | grep -q '"success":true'; then
    echo "✅ 文件上传成功"
    
    # 保存响应到临时文件
    echo "$response" > /tmp/binlog_result.json
    
    # 检查时间戳
    echo ""
    echo "🕒 检查时间戳解析结果:"
    
    if command -v jq &> /dev/null; then
        echo "操作时间戳:"
        jq -r '.operations[] | "\(.type) - \(.database).\(.table) - 时间: \(.timestamp)"' /tmp/binlog_result.json
        
        echo ""
        echo "检查是否有问题时间:"
        
        # 检查1970年的时间
        if jq -r '.operations[].timestamp' /tmp/binlog_result.json | grep -q "1970"; then
            echo "❌ 发现1970年时间戳"
        else
            echo "✅ 没有1970年时间戳"
        fi
        
        # 检查N/A时间
        if jq -r '.operations[].timestamp' /tmp/binlog_result.json | grep -q "N/A\|null"; then
            echo "❌ 发现N/A或null时间戳"
        else
            echo "✅ 没有N/A或null时间戳"
        fi
        
        # 检查时间格式
        echo ""
        echo "时间格式验证:"
        jq -r '.operations[].timestamp' /tmp/binlog_result.json | while read timestamp; do
            if [[ $timestamp =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2}$ ]]; then
                echo "✅ 正确格式: $timestamp"
            else
                echo "❌ 错误格式: $timestamp"
            fi
        done
        
    else
        echo "需要安装jq获得详细分析"
        echo "时间戳样本:"
        grep -o '"timestamp":"[^"]*"' /tmp/binlog_result.json | head -5
    fi
    
    # 清理临时文件
    rm -f /tmp/binlog_result.json
    
else
    echo "❌ 文件上传失败"
    echo "$response"
    exit 1
fi

echo ""
echo "💡 测试建议:"
echo "1. 在浏览器中访问 http://localhost:3000"
echo "2. 上传 test-data/test-binlog.log 文件"
echo "3. 检查操作列表中的时间显示"
echo "4. 点击'查看详情'检查详情页面的时间显示"
echo "5. 测试时间筛选功能"