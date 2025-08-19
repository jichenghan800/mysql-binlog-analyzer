@echo off
echo WSL MySQL Binlog Analyzer - Network Setup
echo ==========================================
echo.
echo Setting up port forwarding...
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.28.236.246

echo.
echo Setting up firewall rule...
netsh advfirewall firewall add rule name="WSL-MySQL-Binlog" dir=in action=allow protocol=TCP localport=3000

echo.
echo Configuration completed!
echo.
echo Access URLs:
echo - Local: http://localhost:3000
echo - LAN: http://[Your-Windows-IP]:3000
echo.
echo To find your Windows IP, run: ipconfig
echo Look for an IP starting with 10.x.x.x
echo.
pause