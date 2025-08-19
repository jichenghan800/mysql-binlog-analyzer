#!/bin/bash
echo "🧪 测试WSL服务访问..."
WSL_IP=$(hostname -I | awk '{print $1}')
echo "测试WSL内部访问: http://$WSL_IP:3000"

if curl -s --connect-timeout 5 http://$WSL_IP:3000 > /dev/null; then
    echo "✅ WSL内部访问正常"
else
    echo "❌ WSL内部访问失败"
fi

echo ""
echo "请在Windows主机上测试:"
echo "1. 打开浏览器访问 http://localhost:3000"
echo "2. 在局域网其他设备访问 http://[Windows主机IP]:3000"
