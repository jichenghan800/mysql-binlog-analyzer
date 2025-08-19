#!/bin/bash

# 测试SQL生成功能

echo "🧪 测试SQL生成功能..."

# 检查服务是否运行
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 服务器未运行，请先启动服务"
    exit 1
fi

# 上传测试文件并获取结果
echo "📤 上传测试文件..."
response=$(curl -s -X POST -F "binlogFile=@test-data/test-binlog.log" http://localhost:3000/upload)

if echo "$response" | grep -q '"success":true'; then
    echo "✅ 文件上传成功"
    
    # 保存响应到临时文件
    echo "$response" > /tmp/binlog_result.json
    
    # 使用jq解析JSON（如果可用）
    if command -v jq &> /dev/null; then
        echo ""
        echo "📊 解析结果："
        
        # 显示每个操作的SQL
        jq -r '.operations[] | "=== \(.type) 操作 (\(.database).\(.table)) ===\n原始SQL: \(.originalSQL)\n回滚SQL: \(.reverseSQL)\n"' /tmp/binlog_result.json
        
    else
        echo ""
        echo "📊 解析结果（需要安装jq获得更好的显示效果）："
        
        # 简单的grep显示
        echo "原始SQL语句："
        grep -o '"originalSQL":"[^"]*"' /tmp/binlog_result.json | sed 's/"originalSQL":"//g' | sed 's/"$//g' | nl
        
        echo ""
        echo "回滚SQL语句："
        grep -o '"reverseSQL":"[^"]*"' /tmp/binlog_result.json | sed 's/"reverseSQL":"//g' | sed 's/"$//g' | nl
    fi
    
    # 清理临时文件
    rm -f /tmp/binlog_result.json
    
else
    echo "❌ 文件上传失败"
    echo "$response"
    exit 1
fi

echo ""
echo "💡 验证要点："
echo "1. INSERT的回滚应该是DELETE"
echo "2. DELETE的回滚应该是INSERT"
echo "3. UPDATE的回滚应该交换SET和WHERE条件"
echo "4. 列名应该是col_1, col_2等格式"
echo "5. 字符串值应该用单引号包围"