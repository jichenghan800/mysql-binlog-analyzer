#!/bin/bash

# 网络配置检查脚本

echo "🔍 网络配置检查..."

# 检查本机IP地址
echo "📍 本机IP地址:"
hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | while read ip; do
    if [[ $ip == 127.* ]]; then
        echo "   $ip (本地回环)"
    elif [[ $ip == 10.* ]] || [[ $ip == 172.* ]] || [[ $ip == 192.168.* ]]; then
        echo "   $ip (局域网)"
    else
        echo "   $ip (公网)"
    fi
done

echo ""

# 检查防火墙状态
echo "🔥 防火墙状态:"
if command -v ufw &> /dev/null; then
    ufw_status=$(sudo ufw status 2>/dev/null | head -1)
    echo "   UFW: $ufw_status"
elif command -v firewall-cmd &> /dev/null; then
    firewall_status=$(sudo firewall-cmd --state 2>/dev/null || echo "未运行")
    echo "   Firewall: $firewall_status"
elif command -v iptables &> /dev/null; then
    iptables_rules=$(sudo iptables -L INPUT 2>/dev/null | wc -l)
    echo "   iptables: $iptables_rules 条规则"
else
    echo "   未检测到防火墙"
fi

echo ""

# 检查端口监听状态
echo "🔌 端口监听状态:"
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   端口 3000: ✅ 正在监听"
    lsof -Pi :3000 -sTCP:LISTEN 2>/dev/null | grep -v COMMAND
else
    echo "   端口 3000: ❌ 未监听"
fi

echo ""

# 网络连通性测试
echo "🌐 网络连通性测试:"
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.')

if [ ! -z "$LOCAL_IP" ]; then
    echo "   测试局域网访问: http://$LOCAL_IP:3000"
    
    if command -v curl &> /dev/null; then
        if curl -s --connect-timeout 5 http://$LOCAL_IP:3000 > /dev/null; then
            echo "   ✅ 局域网访问正常"
        else
            echo "   ❌ 局域网访问失败"
        fi
    else
        echo "   ⚠️  curl 未安装，无法测试连通性"
    fi
else
    echo "   ❌ 未找到局域网IP地址"
fi

echo ""

# 提供解决方案
echo "💡 如果局域网无法访问，请检查:"
echo "   1. 防火墙是否阻止了3000端口"
echo "   2. 服务器是否绑定到 0.0.0.0 而不是 127.0.0.1"
echo "   3. 路由器是否有访问限制"
echo "   4. 客户端和服务器是否在同一网段"

echo ""
echo "🔧 常用防火墙开放端口命令:"
echo "   Ubuntu/Debian: sudo ufw allow 3000"
echo "   CentOS/RHEL: sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload"
echo "   iptables: sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT"