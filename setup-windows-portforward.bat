@echo off
chcp 65001 >nul
echo Setting up WSL port forwarding...
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.28.236.246
echo Setting up firewall rule...
netsh advfirewall firewall add rule name="WSL MySQL Binlog Analyzer" dir=in action=allow protocol=TCP localport=3000
echo Configuration completed!
echo.
echo You can now access the service via:
echo   LAN access: http://[Windows-Host-IP]:3000
echo   Local access: http://localhost:3000
echo.
echo WSL IP: 172.28.236.246
echo Windows Host IP: 172.28.224.1
echo.
pause
