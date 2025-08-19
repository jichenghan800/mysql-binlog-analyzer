#!/bin/bash

# 网络配置脚本 - 支持10网段访问

echo "🔧 配置网络以支持10网段访问..."

# 检查当前网络配置
echo "📍 当前网络配置:"
ip addr show | grep -E "inet [0-9]" | grep -v "127.0.0.1"

echo ""

# 选项1: 添加10网段的虚拟IP (如果你的网络支持)
echo "🌐 选项1: 添加10网段虚拟IP"
echo "如果你的网络环境支持，可以添加一个10网段的虚拟IP:"
echo "sudo ip addr add 10.132.60.69/24 dev eth0"
echo ""

# 选项2: 配置端口转发
echo "🔄 选项2: 配置端口转发"
echo "如果你有另一台10网段的机器，可以配置端口转发:"
echo "在10.132.60.69机器上执行:"
echo "sudo iptables -t nat -A PREROUTING -p tcp --dport 3000 -j DNAT --to-destination 172.28.236.246:3000"
echo "sudo iptables -t nat -A POSTROUTING -p tcp -d 172.28.236.246 --dport 3000 -j MASQUERADE"
echo ""

# 选项3: 使用SSH隧道
echo "🚇 选项3: SSH隧道转发"
echo "在客户端机器上执行:"
echo "ssh -L 3000:172.28.236.246:3000 user@10.132.60.69"
echo "然后访问 http://localhost:3000"
echo ""

# 选项4: 配置nginx反向代理
echo "🔀 选项4: Nginx反向代理"
echo "在10.132.60.69机器上安装nginx并配置:"
cat << 'EOF'
server {
    listen 3000;
    server_name 10.132.60.69;
    
    location / {
        proxy_pass http://172.28.236.246:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo ""

# 检查是否可以ping通10网段
echo "🏓 测试10网段连通性:"
if ping -c 1 -W 2 10.132.60.69 >/dev/null 2>&1; then
    echo "✅ 可以ping通 10.132.60.69"
else
    echo "❌ 无法ping通 10.132.60.69"
    echo "   请检查网络路由配置"
fi

echo ""

# 提供自动配置选项
echo "🤖 自动配置选项:"
echo "1. 尝试添加10网段IP (需要sudo权限)"
echo "2. 显示当前服务访问地址"
echo "3. 退出"

read -p "请选择 (1-3): " choice

case $choice in
    1)
        echo "正在尝试添加10网段IP..."
        if sudo ip addr add 10.132.60.69/24 dev eth0 2>/dev/null; then
            echo "✅ 成功添加IP 10.132.60.69"
            echo "现在可以通过 http://10.132.60.69:3000 访问服务"
        else
            echo "❌ 添加IP失败，可能是权限问题或IP冲突"
            echo "请手动配置或联系网络管理员"
        fi
        ;;
    2)
        echo "📍 当前可访问地址:"
        echo "   本地: http://localhost:3000"
        echo "   局域网: http://172.28.236.246:3000"
        ;;
    3)
        echo "退出配置"
        ;;
    *)
        echo "无效选择"
        ;;
esac