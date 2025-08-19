#!/bin/bash

# WSL网络配置脚本 - 让局域网访问WSL服务

echo "🔧 配置WSL网络以支持局域网访问..."

# 获取WSL IP
WSL_IP=$(hostname -I | awk '{print $1}')
echo "📍 WSL IP: $WSL_IP"

# 获取Windows主机IP (通过默认网关)
WINDOWS_IP=$(ip route | grep default | awk '{print $3}')
echo "📍 Windows主机IP: $WINDOWS_IP"

echo ""
echo "🔧 需要在Windows主机上执行以下配置:"
echo ""

# Windows端口转发配置
echo "1️⃣ 在Windows PowerShell (管理员权限) 中执行端口转发:"
echo "netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$WSL_IP"
echo ""

# Windows防火墙配置
echo "2️⃣ 配置Windows防火墙允许3000端口:"
echo "netsh advfirewall firewall add rule name=\"WSL MySQL Binlog Analyzer\" dir=in action=allow protocol=TCP localport=3000"
echo ""

# 查看现有端口转发
echo "3️⃣ 查看现有端口转发规则:"
echo "netsh interface portproxy show v4tov4"
echo ""

# 删除端口转发 (如果需要)
echo "4️⃣ 如需删除端口转发规则:"
echo "netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0"
echo ""

# 自动生成Windows批处理文件 (使用英文避免编码问题)
echo "📝 生成Windows配置脚本..."
cat > setup-windows-portforward.bat << EOF
@echo off
chcp 65001 >nul
echo Setting up WSL port forwarding...
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$WSL_IP
echo Setting up firewall rule...
netsh advfirewall firewall add rule name="WSL MySQL Binlog Analyzer" dir=in action=allow protocol=TCP localport=3000
echo Configuration completed!
echo.
echo You can now access the service via:
echo   LAN access: http://[Windows-Host-IP]:3000
echo   Local access: http://localhost:3000
echo.
echo WSL IP: $WSL_IP
echo Windows Host IP: $WINDOWS_IP
echo.
pause
EOF

echo "✅ 已生成Windows配置文件:"
echo "   - setup-windows-portforward.bat (自动生成)"
echo "   - setup-windows-portforward.ps1 (PowerShell版本)"
echo "   - setup-windows-simple.bat (简单版本)"
echo "   - windows-commands.txt (手动命令)"
echo ""
echo "推荐使用 setup-windows-portforward.ps1 (PowerShell版本)"

echo ""
echo "🔍 检查WSL网络配置:"

# 检查WSL是否可以访问外网
if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
    echo "✅ WSL网络连接正常"
else
    echo "❌ WSL网络连接异常"
fi

# 检查服务是否在运行
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ 服务正在端口3000运行"
    echo "📍 WSL内访问: http://$WSL_IP:3000"
else
    echo "❌ 服务未在端口3000运行"
    echo "请先启动服务: npm start"
fi

echo ""
echo "📋 完整配置步骤:"
echo "1. 确保WSL服务正在运行 (当前脚本检查)"
echo "2. 将 setup-windows-portforward.bat 复制到Windows"
echo "3. 以管理员权限运行 setup-windows-portforward.bat"
echo "4. 在局域网其他设备上访问 http://[Windows主机10网段IP]:3000"

echo ""
echo "🔧 故障排除:"
echo "- 如果无法访问，检查Windows防火墙设置"
echo "- 确认Windows主机的10网段IP地址"
echo "- 检查路由器是否有访问限制"
echo "- 可以在Windows上用 netstat -an | findstr :3000 检查端口监听"

# 创建一个测试脚本
cat > test-wsl-access.sh << 'EOF'
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
EOF

chmod +x test-wsl-access.sh
echo "✅ 已生成测试脚本 test-wsl-access.sh"