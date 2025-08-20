# 自定义加载图标

## 如何替换加载图标

1. 将你的图片文件重命名为 `loading-icon.png`
2. 将图片放到 `public/` 目录下
3. 推荐图片尺寸：60x60像素或更大（会自动缩放）
4. 支持格式：PNG、JPG、GIF、SVG

## 当前设置

- 图片路径：`/loading-icon.png`
- 显示尺寸：60x60像素
- 降级方案：如果图片加载失败，会显示🤖表情符号

## 示例

```html
<!-- 当前代码 -->
<img src="/loading-icon.png" alt="加载中" style="width: 60px; height: 60px; object-fit: contain;">
```

你可以替换为任何你喜欢的图片，比如：
- 机器猫/哆啦A梦图片
- 公司Logo
- 自定义动画GIF
- 其他可爱的图标