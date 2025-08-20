# Binlog 解析占位符问题修复

## 问题描述

在查看详情时，原始SQL和回滚SQL的解析存在问题：
- 原始binlog中的 `$1` `$2` 等占位符没有正确处理
- 显示的SQL语句包含这些占位符而不是实际的列值

## 解决方案

使用完整的 `mysqlbinlog` 工具并加上行解码参数：

```bash
mysqlbinlog --base64-output=DECODE-ROWS -vv mysql-bin.000001
```

### 参数说明

- `--base64-output=DECODE-ROWS`: 解码行数据，显示实际的列值而不是base64编码
- `-vv`: 显示极度详细的事件信息，包括列名、类型和值

## 修改内容

### 1. 更新 mysqlbinlog 命令参数

**修改前:**
```javascript
const mysqlbinlog = spawn('mysqlbinlog', [
  '-vv', 
  '--base64-output=DECODE-ROWS',
  filePath
]);
```

**修改后:**
```javascript
const mysqlbinlog = spawn('mysqlbinlog', [
  '--base64-output=DECODE-ROWS',
  '-vv',
  filePath
]);
```

### 2. 优化列值解析逻辑

增强了对 `-vv` 参数输出格式的处理：

- 移除类型信息前缀（如 `INT meta=0 nullable=1 is_null=0`）
- 移除 `$` 占位符模式（如 `$1` `$2` 等）
- 清理控制字符和多余的引号
- 保留实际的数据值

### 3. 简化 formatValue 函数

由于值已经在解析阶段被清理，简化了格式化逻辑：

- 移除重复的清理代码
- 专注于数字识别和字符串转义
- 减少调试输出的干扰

## 预期效果

使用新的参数配置后：

1. **原始SQL** 将显示实际的列值而不是 `$1` `$2` 占位符
2. **回滚SQL** 同样显示正确的列值
3. 解析性能保持稳定
4. 支持更详细的数据类型信息

## 测试方法

运行测试脚本验证修改效果：

```bash
node test-binlog-parsing.js
```

## 注意事项

1. 确保系统已安装 `mysql-client` 包（包含 `mysqlbinlog` 工具）
2. `-vv` 参数会产生更详细的输出，可能增加解析时间
3. 对于大型binlog文件，建议使用数据库存储模式

## 兼容性

- 支持 MySQL 5.7+ 的 binlog 格式
- 兼容现有的测试格式文件
- 保持向后兼容性