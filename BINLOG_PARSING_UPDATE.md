# Binlog 解析命令优化更新

## 更新说明

使用更精炼的 mysqlbinlog 命令替换之前的 `-vv` 参数方案：

```bash
mysqlbinlog --base64-output=DECODE-ROWS -v mysql-bin.000001 \
  | sed -E 's:/\*[^*]*\*+([^/*][^*]*\*+)*/::g'
```

## 优化点

### 1. 参数调整
- 从 `-vv` 改为 `-v`：减少冗余输出，提高解析效率
- 保留 `--base64-output=DECODE-ROWS`：确保行数据解码

### 2. 添加 sed 过滤
- 使用正则表达式移除 MySQL 注释：`s:/\*[^*]*\*+([^/*][^*]*\*+)*/::g`
- 获得更干净、精炼的输出

### 3. 实现方式
使用 shell 命令管道：
```javascript
const mysqlbinlog = spawn('sh', [
  '-c',
  `mysqlbinlog --base64-output=DECODE-ROWS -v "${filePath}" | sed -E 's:/\\*[^*]*\\*+([^/*][^*]*\\*+)*/::g'`
]);
```

## 预期效果

1. **更精炼的输出**：移除不必要的注释和冗余信息
2. **更快的解析**：减少需要处理的数据量
3. **更清晰的结果**：专注于实际的数据变更内容
4. **保持准确性**：仍然解决 `$1` `$2` 占位符问题

## 兼容性

- 需要系统支持 `sed` 命令（Linux/macOS 默认支持）
- 保持与现有解析逻辑的兼容性
- 适用于所有 MySQL binlog 格式