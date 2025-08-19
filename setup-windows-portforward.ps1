# WSL端口转发配置脚本 (PowerShell版本)
# 请以管理员权限运行此脚本

param(
    [string]$WSLIp = "172.28.236.246",
    [int]$Port = 3000
)

Write-Host "=== WSL MySQL Binlog 分析工具网络配置 ===" -ForegroundColor Green
Write-Host ""

# 检查管理员权限
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "错误: 此脚本需要管理员权限运行" -ForegroundColor Red
    Write-Host "请右键点击PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    Read-Host "按任意键退出"
    exit 1
}

Write-Host "✓ 管理员权限检查通过" -ForegroundColor Green

# 配置端口转发
Write-Host ""
Write-Host "配置端口转发规则..." -ForegroundColor Yellow
try {
    $result = netsh interface portproxy add v4tov4 listenport=$Port listenaddress=0.0.0.0 connectport=$Port connectaddress=$WSLIp
    Write-Host "✓ 端口转发配置成功" -ForegroundColor Green
    Write-Host "  $WSLIp:$Port -> 0.0.0.0:$Port" -ForegroundColor Cyan
} catch {
    Write-Host "✗ 端口转发配置失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 配置防火墙规则
Write-Host ""
Write-Host "配置防火墙规则..." -ForegroundColor Yellow
try {
    $result = netsh advfirewall firewall add rule name="WSL MySQL Binlog Analyzer" dir=in action=allow protocol=TCP localport=$Port
    Write-Host "✓ 防火墙规则配置成功" -ForegroundColor Green
} catch {
    Write-Host "✗ 防火墙规则配置失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 显示配置结果
Write-Host ""
Write-Host "=== 配置结果 ===" -ForegroundColor Green

Write-Host ""
Write-Host "端口转发规则:" -ForegroundColor Yellow
netsh interface portproxy show v4tov4

Write-Host ""
Write-Host "端口监听状态:" -ForegroundColor Yellow
netstat -an | findstr ":$Port"

# 获取本机IP地址
Write-Host ""
Write-Host "本机IP地址:" -ForegroundColor Yellow
$networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }
foreach ($adapter in $networkAdapters) {
    $ip = $adapter.IPAddress
    if ($ip -like "10.*" -or $ip -like "192.168.*" -or $ip -like "172.*") {
        Write-Host "  $ip (局域网)" -ForegroundColor Cyan
    } else {
        Write-Host "  $ip" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "=== 访问地址 ===" -ForegroundColor Green
Write-Host "本地访问: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "WSL访问: http://$WSLIp`:$Port" -ForegroundColor Cyan

$localIPs = $networkAdapters | Where-Object { $_.IPAddress -like "10.*" -or $_.IPAddress -like "192.168.*" -or ($_.IPAddress -like "172.*" -and $_.IPAddress -notlike "172.28.*") }
if ($localIPs) {
    Write-Host "局域网访问:" -ForegroundColor Cyan
    foreach ($adapter in $localIPs) {
        Write-Host "  http://$($adapter.IPAddress):$Port" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "=== 测试连接 ===" -ForegroundColor Green
Write-Host "测试WSL连接..." -ForegroundColor Yellow
try {
    $response = Test-NetConnection -ComputerName $WSLIp -Port $Port -WarningAction SilentlyContinue
    if ($response.TcpTestSucceeded) {
        Write-Host "✓ WSL连接测试成功" -ForegroundColor Green
    } else {
        Write-Host "✗ WSL连接测试失败" -ForegroundColor Red
        Write-Host "  请确保WSL中的服务正在运行" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ 连接测试失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 故障排除 ===" -ForegroundColor Yellow
Write-Host "如果无法访问，请检查:"
Write-Host "1. WSL服务是否正在运行"
Write-Host "2. Windows防火墙设置"
Write-Host "3. 杀毒软件是否阻止连接"
Write-Host "4. 路由器防火墙设置"

Write-Host ""
Write-Host "=== 管理命令 ===" -ForegroundColor Yellow
Write-Host "查看端口转发: netsh interface portproxy show v4tov4"
Write-Host "删除端口转发: netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0"
Write-Host "删除防火墙规则: netsh advfirewall firewall delete rule name=`"WSL MySQL Binlog Analyzer`""

Write-Host ""
Write-Host "配置完成！" -ForegroundColor Green
Read-Host "按任意键退出"