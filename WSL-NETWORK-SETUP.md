# WSL网络配置指南

## 问题描述
项目在WSL中运行，需要让Windows主机所在的10网段局域网能够访问MySQL Binlog分析工具。

## 解决方案

### 1. 确认当前状态
- WSL IP: `172.28.236.246`
- Windows主机IP: `172.28.224.1`
- 服务端口: `3000`

### 2. Windows端配置 (必须以管理员权限执行)

#### 方法一：使用PowerShell脚本 (推荐)
1. 将 `setup-windows-portforward.ps1` 文件复制到Windows主机
2. 右键点击PowerShell，选择"以管理员身份运行"
3. 执行：`.\setup-windows-portforward.ps1`
4. 按提示完成配置

#### 方法二：使用简单批处理文件
1. 将 `setup-windows-simple.bat` 文件复制到Windows主机
2. 右键点击文件，选择"以管理员身份运行"
3. 等待配置完成

#### 方法三：手动执行PowerShell命令
打开PowerShell (管理员权限)，执行以下命令：

```powershell
# 添加端口转发规则
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.28.236.246

# 配置防火墙规则
netsh advfirewall firewall add rule name="WSL MySQL Binlog Analyzer" dir=in action=allow protocol=TCP localport=3000

# 查看配置结果
netsh interface portproxy show v4tov4
```

### 3. 获取Windows主机的10网段IP

在Windows命令提示符中执行：
```cmd
ipconfig
```

找到以10开头的IP地址，例如：`10.132.60.69`

### 4. 测试访问

#### 在Windows主机上测试：
- 浏览器访问：`http://localhost:3000`

#### 在局域网其他设备上测试：
- 浏览器访问：`http://10.132.60.69:3000` (替换为实际的Windows主机IP)

### 5. 验证配置

#### 检查端口转发规则：
```powershell
netsh interface portproxy show v4tov4
```

#### 检查端口监听：
```cmd
netstat -an | findstr :3000
```

应该看到类似输出：
```
TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING
```

### 6. 故障排除

#### 如果无法访问，请检查：

1. **WSL服务是否运行**
   ```bash
   # 在WSL中执行
   ./status.sh
   ```

2. **Windows防火墙设置**
   - 打开Windows Defender防火墙
   - 检查是否有阻止3000端口的规则

3. **端口转发规则是否生效**
   ```powershell
   netsh interface portproxy show v4tov4
   ```

4. **网络连通性**
   ```cmd
   # 在Windows中测试WSL连通性
   ping 172.28.236.246
   ```

#### 常见问题解决：

**问题1：端口转发不生效**
```powershell
# 删除现有规则
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
# 重新添加
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.28.236.246
```

**问题2：防火墙阻止**
```powershell
# 删除现有规则
netsh advfirewall firewall delete rule name="WSL MySQL Binlog Analyzer"
# 重新添加
netsh advfirewall firewall add rule name="WSL MySQL Binlog Analyzer" dir=in action=allow protocol=TCP localport=3000
```

**问题3：WSL IP变化**
WSL重启后IP可能会变化，需要重新配置端口转发规则。

### 7. 清理配置

如需移除配置：
```powershell
# 删除端口转发
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0

# 删除防火墙规则
netsh advfirewall firewall delete rule name="WSL MySQL Binlog Analyzer"
```

## 自动化脚本

项目提供了以下脚本：
- `setup-wsl-network.sh` - WSL端网络配置检查
- `setup-windows-portforward.bat` - Windows端自动配置
- `test-wsl-access.sh` - 访问测试脚本

## 最终访问地址

配置完成后，可以通过以下地址访问：
- WSL内部：`http://172.28.236.246:3000`
- Windows本地：`http://localhost:3000`
- 局域网访问：`http://[Windows主机10网段IP]:3000`

例如：`http://10.132.60.69:3000`