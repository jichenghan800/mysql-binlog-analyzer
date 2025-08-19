FROM node:18-alpine

# 安装MySQL客户端工具
RUN apk add --no-cache mysql-client mysql

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建必要目录
RUN mkdir -p uploads logs

# 暴露端口
EXPOSE 3000

# 设置Node.js内存限制并启动应用
ENV NODE_OPTIONS="--max-old-space-size=16384"
CMD ["node", "server.js"]
CMD ["node", "server.js"]