FROM node:18-slim

# 更新包列表并安装MySQL客户端工具
RUN apt-get update && \
    apt-get install -y mysql-client-core-8.0 mysql-client-8.0 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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
ENTRYPOINT ["node", "server.js"]