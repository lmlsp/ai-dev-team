# 《合合小厨神》部署方案

> 版本：v1.0 | 日期：2026-05-31 | 作者：DevOps Engineer
> 对应架构文档：02-architecture.md
> 前端 appid：wx884086128839f921
> 后端域名：api.chefgame.cn

---

## 目录

1. [Docker 部署方案](#1-docker-部署方案)
2. [Nginx 配置](#2-nginx-配置)
3. [CI/CD 流程](#3-cicd-流程)
4. [发布流程](#4-发布流程)
5. [回滚方案](#5-回滚方案)
6. [监控方案](#6-监控方案)
7. [上线前最终检查清单](#7-上线前最终检查清单)
8. [成本估算](#8-成本估算)

---

## 1. Docker 部署方案

### 1.1 Dockerfile 审核与完善

**现有问题：**

| # | 问题 | 风险 |
|---|------|------|
| 1 | `COPY target/chef-game-1.0.0.jar` 硬编码版本号，每次升级需改 Dockerfile | 易出错 |
| 2 | `openjdk:17-slim` 镜像未固定 digest，构建不可复现 | 安全/稳定性 |
| 3 | 缺少非 root 用户，容器内以 root 运行 | 安全合规 |
| 4 | 未启用 Spring Boot 优雅停机 | 滚动更新丢请求 |
| 5 | 缺少健康检查 HEALTHCHECK | 无法感知应用状态 |

**完善后的 Dockerfile：**

```dockerfile
# ---- Stage 1: 构建 ----
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /build
COPY pom.xml .
# 先下载依赖（利用 Docker 缓存层）
RUN mvn dependency:go-offline -B -q

COPY src/ src/
RUN mvn package -DskipTests -B -q

# ---- Stage 2: 运行 ----
FROM eclipse-temurin:17-jre-alpine@sha256:e7b0c8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8

# 安全：创建非 root 用户
RUN addgroup -S chefgame && adduser -S chefgame -G chefgame

WORKDIR /app

# 从构建阶段复制 JAR（使用通配符避免硬编码版本）
COPY --from=builder /build/target/*.jar app.jar

# Spring Boot 优雅停机
ENV JAVA_OPTS="-Xms256m -Xmx512m \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:+ExitOnOutOfMemoryError \
  -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

USER chefgame

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

### 1.2 docker-compose.yml 审核与完善

**现有问题：**

| # | 问题 | 风险 |
|---|------|------|
| 1 | MySQL healthcheck 中 `-p${DB_PASSWORD}` 如果密码含特殊字符会失败 | 启动失败 |
| 2 | app 服务端口暴露到宿主机 `8080:8080`，绕过 Nginx | 安全风险 |
| 3 | 缺少 `.env.example` 模板 | 新人部署困难 |
| 4 | MySQL 未配置字符集和时区参数 | 中文乱码 |
| 5 | Redis 未配置最大内存和淘汰策略 | OOM 风险 |
| 6 | 未配置日志卷，日志丢失 | 运维困难 |
| 7 | 缺少应用层健康检查依赖 `condition: service_healthy` | 启动顺序不保证 |

**完善后的 docker-compose.yml：**

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro                          # SSL 证书目录
      - ./certbot/www:/var/www/certbot:ro                 # Let's Encrypt 验证
      - nginx_logs:/var/log/nginx
    depends_on:
      - app
    restart: always
    networks:
      - chef_game_net
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  app:
    build: .
    image: chef-game:${APP_VERSION:-latest}
    # 不暴露端口到宿主机，仅通过 Nginx 代理访问
    expose:
      - "8080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=chef_game
      - DB_USER=chef
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - WECHAT_APPID=${WECHAT_APPID}
      - WECHAT_APP_SECRET=${WECHAT_APP_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - YLH_SECRET_KEY=${YLH_SECRET_KEY}
      - TZ=Asia/Shanghai
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always
    networks:
      - chef_game_net
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  mysql:
    image: mysql:8.0.33
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --default-time-zone=+08:00
      - --max_connections=200
      - --innodb_buffer_pool_size=256M
      - --slow_query_log=1
      - --slow_query_log_file=/var/log/mysql/slow.log
      - --long_query_time=0.5
      - --log_bin_trust_function_creators=1
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: chef_game
      MYSQL_USER: chef
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - mysql_logs:/var/log/mysql
      - ./src/main/resources/db/migration:/docker-entrypoint-initdb.d:ro
      - ./deploy/mysql/conf.d:/etc/mysql/conf.d:ro               # 自定义 MySQL 配置
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "chef", "--password=$${MYSQL_PWD}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: always
    networks:
      - chef_game_net

  redis:
    image: redis:7.2-alpine
    command: >
      redis-server
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: always
    networks:
      - chef_game_net
    logging:
      driver: "json-file"
      options:
        max-size: "30m"
        max-file: "3"

volumes:
  mysql_data:
    driver: local
  mysql_logs:
    driver: local
  redis_data:
    driver: local
  nginx_logs:
    driver: local

networks:
  chef_game_net:
    driver: bridge
```

### 1.3 环境变量清单

创建 `.env.example` 文件（**此文件可提交到 Git**）：

```bash
# ============================================================
# 合合小厨神 — 环境变量清单
# 复制为 .env 后填入真实值，.env 文件切勿提交到 Git！
# ============================================================

# ---- 应用版本 ----
APP_VERSION=1.0.0

# ---- 数据库 ----
DB_ROOT_PASSWORD=<openssl rand -base64 32 生成>
DB_PASSWORD=<openssl rand -base64 24 生成>

# ---- Redis ----
REDIS_PASSWORD=<openssl rand -base64 24 生成>

# ---- 微信小程序 ----
# 来源：微信公众平台 → 开发管理 → 开发设置 → AppID/AppSecret
WECHAT_APPID=wx884086128839f921
WECHAT_APP_SECRET=<从微信公众平台获取>

# ---- JWT ----
# 生成方式：openssl rand -base64 64
JWT_SECRET=<openssl rand -base64 64 生成>

# ---- 优量汇广告 ----
# 来源：优量汇后台 → 媒体管理 → 应用 → 密钥
YLH_SECRET_KEY=<从优量汇后台获取>
```

**各环境变量的生成方式：**

| 变量 | 生成命令 | 说明 |
|------|---------|------|
| `DB_ROOT_PASSWORD` | `openssl rand -base64 32` | MySQL root 密码，仅运维使用 |
| `DB_PASSWORD` | `openssl rand -base64 24` | MySQL 应用账户密码 |
| `REDIS_PASSWORD` | `openssl rand -base64 24` | Redis 密码 |
| `JWT_SECRET` | `openssl rand -base64 64` | JWT 签名密钥，至少 256 位 |
| `WECHAT_APP_SECRET` | 微信公众平台获取 | 不可自行生成 |
| `YLH_SECRET_KEY` | 优量汇后台获取 | 不可自行生成 |

**一键生成所有密码（Linux/macOS）：**

```bash
echo "DB_ROOT_PASSWORD=$(openssl rand -base64 32)"
echo "DB_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -base64 64)"
```

**Windows Server 一键生成（PowerShell）：**

```powershell
function New-Password($length) { [Convert]::ToBase64String((1..$length | ForEach-Object { Get-Random -Max 256 })) }
Write-Host "DB_ROOT_PASSWORD=$(New-Password 32)"
Write-Host "DB_PASSWORD=$(New-Password 24)"
Write-Host "REDIS_PASSWORD=$(New-Password 24)"
Write-Host "JWT_SECRET=$(New-Password 64)"
```

### 1.4 数据持久化方案

```
┌────────────────────────────────────────────────────────────┐
│                    数据持久化架构                            │
│                                                            │
│  宿主机                          Docker Volumes             │
│  /data/chef-game/                                         │
│  ├── mysql/         ←──────────  mysql_data                │
│  │   ├── ibdata1                  (InnoDB 数据)            │
│  │   ├── chef_game/               (数据库目录)              │
│  │   ├── binlog/                  (Binlog，用于恢复)         │
│  │   └── slow.log                 (慢查询日志)              │
│  ├── redis/         ←──────────  redis_data                │
│  │   └── appendonly.aof           (AOF 持久化)             │
│  ├── nginx-logs/    ←──────────  nginx_logs                │
│  │   ├── access.log                                         │
│  │   └── error.log                                          │
│  └── backups/                                           │
│      ├── db/                       (数据库定时备份)          │
│      └── redis/                    (Redis 备份)            │
└────────────────────────────────────────────────────────────┘
```

**MySQL 备份脚本（`deploy/scripts/backup-db.sh`）：**

```bash
#!/bin/bash
# 每日凌晨 2 点由 crontab 执行：0 2 * * * /opt/chef-game/deploy/scripts/backup-db.sh

BACKUP_DIR="/data/chef-game/backups/db"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="chef-game-mysql"
DB_NAME="chef_game"
DB_USER="chef"
DB_PASSWORD="${DB_PASSWORD}"

mkdir -p "$BACKUP_DIR"

# 全量备份
docker exec "$CONTAINER_NAME" mysqldump \
  -u "$DB_USER" -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# 删除 30 天前的备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed: ${DB_NAME}_${TIMESTAMP}.sql.gz"
```

**Redis 备份（`deploy/scripts/backup-redis.sh`）：**

```bash
#!/bin/bash
# Redis AOF 持久化已开启，此脚本做定期快照备份

BACKUP_DIR="/data/chef-game/backups/redis"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# 触发 BGSAVE 并等待完成
docker exec chef-game-redis redis-cli -a "${REDIS_PASSWORD}" BGSAVE

# 复制 RDB 文件
docker cp chef-game-redis:/data/dump.rdb "$BACKUP_DIR/dump_${TIMESTAMP}.rdb"

find "$BACKUP_DIR" -name "*.rdb" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Redis backup completed"
```

**备份恢复验证（纳入月度演练）：**

```bash
# 1. 在独立环境中启动一个空 MySQL
# 2. 导入备份
gunzip < backup.sql.gz | docker exec -i test-mysql mysql -u root -p"$DB_ROOT_PASSWORD" chef_game
# 3. 验证行数
docker exec test-mysql mysql -u root -p"$DB_ROOT_PASSWORD" -e "SELECT COUNT(*) FROM chef_game.user;"
```

### 1.5 健康检查配置

**应用层（Spring Boot Actuator）：**

在 `pom.xml` 中添加依赖：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

`application-prod.yml` 中添加：

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
      base-path: /actuator
  endpoint:
    health:
      show-details: when-authorized
      show-components: when-authorized
      probes:
        enabled: true
  health:
    db:
      enabled: true
    redis:
      enabled: true
  metrics:
    export:
      prometheus:
        enabled: true
```

**Nginx 反向代理健康检查：**

```nginx
# 健康检查端点不限制速率
location /actuator/health {
    proxy_pass http://chef_game_backend;
    access_log off;                           # 不记录健康检查日志
}
```

**整体健康检查架构：**

```
外部监控 (Prometheus/Grafana Cloud)
    │
    ▼ GET /actuator/health (每 30s)
    │
Nginx (反向代理)
    │
    ▼ proxy_pass http://app:8080
    │
Spring Boot Actuator
    ├── DB:    SELECT 1 (验证 MySQL 连接)
    ├── Redis: PING    (验证 Redis 连接)
    └── Disk: 检查可用空间 < 100MB 则 UNHEALTHY
```

---

## 2. Nginx 配置

### 2.1 现有 nginx.conf 审核

**现有问题：**

| # | 问题 | 风险等级 | 说明 |
|---|------|---------|------|
| 1 | **只监听 80 端口，无 HTTPS** | **阻断** | 微信小程序强制要求 HTTPS，无 HTTPS 无法上线 |
| 2 | 未配置 SSL 证书路径 | **阻断** | 同上 |
| 3 | 缺少安全头（HSTS、CSP 等） | 高 | 点击劫持、MIME 嗅探 |
| 4 | `server_name` 未设置（使用默认 server） | 中 | 可能被恶意 DNS 指向 |
| 5 | proxy 未设置 buffer 大小 | 低 | 大响应体可能被截断 |
| 6 | 未配置 gzip 压缩 | 低 | 浪费带宽 |
| 7 | 缺少客户端 body 大小限制 | 中 | 可能被大请求体攻击 |

### 2.2 完善后的 nginx.conf

```nginx
# ============================================================
# 合合小厨神 — Nginx 配置（HTTPS + 限流 + 安全）
# 路径：/etc/nginx/conf.d/default.conf
# ============================================================

# ---- 限流区域定义 ----
# 通用 API 限流：单 IP 每秒 50 请求
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;

# 登录接口限流：单 IP 每分钟 3 次
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=3r/m;

# 广告回调限流区（优量汇 S2S 可能有 burst）
limit_req_zone $binary_remote_addr zone=ad_callback:10m rate=100r/m;

# ---- 连接数限制 ----
limit_conn_zone $binary_remote_addr zone=conn_per_ip:10m;

# ---- Upstream ----
upstream chef_game_backend {
    server app:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
    keepalive_timeout 60s;
    keepalive_requests 100;
}

# ============================================================
# HTTPS Server（微信小程序强制要求）
# ============================================================
server {
    listen 443 ssl http2;
    server_name api.chefgame.cn;

    # 单 IP 最大 20 并发连接
    limit_conn conn_per_ip 20;

    # ---- SSL 证书 ----
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # ---- SSL 配置（Mozilla Intermediate） ----
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 1.1.1.1 valid=300s;
    resolver_timeout 5s;

    # ---- 安全头 ----
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # ---- 基础配置 ----
    client_max_body_size 1m;                    # 限制请求体大小
    client_body_buffer_size 128k;

    # 微信小程序要求：请求超时最长 60s
    proxy_read_timeout 60s;
    proxy_connect_timeout 10s;
    proxy_send_timeout 10s;

    # Proxy Buffer
    proxy_buffer_size 4k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;

    # ---- Gzip 压缩 ----
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types application/json text/plain;
    gzip_proxied any;

    # ---- 健康检查（不限流） ----
    location /actuator/health {
        proxy_pass http://chef_game_backend;
        access_log off;
    }

    # ---- 广告回调（不校验 JWT） ----
    location /api/v1/ad/callback/ {
        limit_req zone=ad_callback burst=20 nodelay;
        proxy_pass http://chef_game_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- 登录接口（严格限流：每分钟 3 次） ----
    location /api/v1/auth/ {
        limit_req zone=login_limit burst=3 nodelay;
        proxy_pass http://chef_game_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- 通用 API ----
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://chef_game_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- 静态资源（如有 CDN 可替代） ----
    location /static/ {
        root /var/www/chefgame;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}

# ============================================================
# HTTP → HTTPS 重定向
# ============================================================
server {
    listen 80;
    server_name api.chefgame.cn;

    # Let's Encrypt HTTP-01 验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 其他请求跳转 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
```

### 2.3 SSL 证书申请方案（Let's Encrypt）

**方案一：Certbot + Docker（推荐）**

```bash
# 1. 首次申请：使用 standalone 模式（需要临时停 Nginx）
docker run -it --rm \
  -v /opt/chef-game/ssl:/etc/letsencrypt \
  -v /opt/chef-game/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d api.chefgame.cn \
  --email admin@chefgame.cn \
  --agree-tos --non-interactive

# 2. 将证书链接到 Nginx 使用的目录
cd /opt/chef-game/ssl
ln -sf /etc/letsencrypt/live/api.chefgame.cn/fullchain.pem fullchain.pem
ln -sf /etc/letsencrypt/live/api.chefgame.cn/privkey.pem privkey.pem

# 3. 启动 Nginx
docker compose up -d nginx

# 4. 设置自动续期（crontab，每月 1 号和 15 号凌晨 3 点）
# crontab -e
0 3 1,15 * * docker run --rm \
  -v /opt/chef-game/ssl:/etc/letsencrypt \
  -v /opt/chef-game/certbot/www:/var/www/certbot \
  certbot/certbot renew --quiet && \
  docker exec chef-game-nginx nginx -s reload
```

**方案二：acme.sh（备选，支持阿里云/腾讯云 DNS API 自动续期）**

```bash
# 安装
curl https://get.acme.sh | sh

# 使用 DNS API 验证（无需停 Nginx，推荐腾讯云 DNSPod）
export DP_Id="<DNSPod ID>"
export DP_Key="<DNSPod Token>"
acme.sh --issue --dns dns_dp -d api.chefgame.cn

# 安装证书
acme.sh --install-cert -d api.chefgame.cn \
  --key-file       /opt/chef-game/ssl/privkey.pem \
  --fullchain-file /opt/chef-game/ssl/fullchain.pem \
  --reloadcmd      "docker exec chef-game-nginx nginx -s reload"

# 自动续期（acme.sh 自带 crontab，无需手动配置）
```

### 2.4 限流配置细则

| 接口 | 限流策略 | 说明 |
|------|---------|------|
| `/api/v1/auth/login` | 3 req/min, burst 3 | 登录接口防暴力破解 |
| `/api/v1/ad/callback/ylh` | 100 req/min | 优量汇 S2S 回调（不限太死） |
| `/api/v1/board/sync` | 50 req/s | 棋盘同步高频接口 |
| 其他 `/api/*` | 50 req/s, burst 50 | 通用 API |
| 连接数 | 20 conn/IP | 全局限流 |
| 请求体大小 | 1MB | 防大请求攻击 |

### 2.5 微信小程序域名白名单检查

**小程序后台 → 开发管理 → 开发设置 → 服务器域名，需配置以下 4 类域名：**

| 类型 | 域名 | 说明 |
|------|------|------|
| **request 合法域名** | `https://api.chefgame.cn` | 所有业务 API |
| **socket 合法域名** | `wss://api.chefgame.cn` | WebSocket（如后续需要实时功能） |
| **uploadFile 合法域名** | `https://api.chefgame.cn` | 文件上传（如用户头像） |
| **downloadFile 合法域名** | `https://api.chefgame.cn` | 文件下载（如配置表更新） |

**注意事项：**
- 域名必须已完成 ICP 备案（微信强制要求）
- 每月可修改 5 次，修改后需重新提审
- 不支持 IP 地址和 `localhost`
- 不支持端口号（必须是 443 端口）
- 二级域名需单独添加

---

## 3. CI/CD 流程

### 3.1 GitHub Actions 工作流总览

```
┌────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                           │
│                                                            │
│  Push to main ──▶ Build & Test ──▶ Build Image ──▶ Deploy │
│                    │                  │              │     │
│                    ▼                  ▼              ▼     │
│              Maven 构建          Docker Build     SSH 到服务器│
│              JUnit 测试         阿里云 ACR Push   docker compose│
│              PMD 静态分析       镜像 Tag 管理     up -d 替换 │
└────────────────────────────────────────────────────────────┘
```

### 3.2 GitHub Actions 完整 Workflow

**文件：`.github/workflows/deploy.yml`**

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
  workflow_dispatch:                    # 支持手动触发
    inputs:
      environment:
        description: '部署环境'
        required: true
        default: 'production'
        type: choice
        options: [production, staging]

env:
  APP_NAME: chef-game
  APP_VERSION: 1.0.0
  JAVA_VERSION: '17'
  # 阿里云容器镜像仓库
  REGISTRY: registry.cn-hangzhou.aliyuncs.com
  NAMESPACE: chefgame

jobs:
  # ========== Job 1: 测试 ==========
  test:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK ${{ env.JAVA_VERSION }}
        uses: actions/setup-java@v4
        with:
          java-version: ${{ env.JAVA_VERSION }}
          distribution: 'temurin'
          cache: maven

      - name: Run all tests
        run: |
          cd 04-code/backend
          mvn test -B --no-transfer-progress
        env:
          DB_PASSWORD: test
          REDIS_PASSWORD: test

      - name: Publish test report
        uses: dorny/test-reporter@v1
        if: success() || failure()
        with:
          name: JUnit Tests
          path: '04-code/backend/target/surefire-reports/*.xml'
          reporter: java-junit

      - name: PMD static analysis
        run: |
          cd 04-code/backend
          mvn pmd:check -B --no-transfer-progress || true

  # ========== Job 2: 构建 & 推送镜像 ==========
  build:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    outputs:
      image_tag: ${{ steps.meta.outputs.version }}
    steps:
      - uses: actions/checkout@v4

      # ---- 2a. 构建后端 JAR ----
      - name: Set up JDK ${{ env.JAVA_VERSION }}
        uses: actions/setup-java@v4
        with:
          java-version: ${{ env.JAVA_VERSION }}
          distribution: 'temurin'
          cache: maven

      - name: Build Spring Boot JAR
        run: |
          cd 04-code/backend
          mvn package -DskipTests -B --no-transfer-progress

      # ---- 2b. 登录阿里云 ACR ----
      - name: Login to Alibaba Cloud ACR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.ALIYUN_ACR_USERNAME }}
          password: ${{ secrets.ALIYUN_ACR_PASSWORD }}

      # ---- 2c. 构建并推送 Docker 镜像 ----
      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.NAMESPACE }}/${{ env.APP_NAME }}
          tags: |
            type=raw,value=${{ env.APP_VERSION }}-${{ github.run_number }}
            type=raw,value=latest
            type=sha,prefix=

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: 04-code/backend
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.NAMESPACE }}/${{ env.APP_NAME }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.NAMESPACE }}/${{ env.APP_NAME }}:buildcache,mode=max

  # ========== Job 3: 部署 ==========
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://api.chefgame.cn
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/chef-game

            # 拉取最新 docker-compose 配置
            git pull origin main

            # 登录阿里云 ACR
            echo "${{ secrets.ALIYUN_ACR_PASSWORD }}" | \
              docker login registry.cn-hangzhou.aliyuncs.com -u ${{ secrets.ALIYUN_ACR_USERNAME }} --password-stdin

            # 拉取新镜像
            IMAGE_TAG="${{ needs.build.outputs.image_tag }}"
            docker pull registry.cn-hangzhou.aliyuncs.com/chefgame/chef-game:${IMAGE_TAG}

            # 滚动更新（详见 4.1 节）
            export APP_VERSION=${IMAGE_TAG}
            docker compose up -d --no-deps --scale app=2 app
            sleep 10
            docker compose up -d --no-deps --scale app=1 app

            # 清理旧镜像（保留最近 3 个版本）
            docker image prune -a --filter "until=24h" -f

            # 健康检查确认
            sleep 5
            curl -f http://localhost:8080/actuator/health || exit 1

            echo "Deploy success: ${IMAGE_TAG}"

      - name: Notify deploy result
        if: always()
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "Deploy ${{ job.status }}: chef-game ${{ needs.build.outputs.image_tag }}\n${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 3.3 GitHub Secrets 配置清单

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret Name | 说明 | 来源 |
|-------------|------|------|
| `ALIYUN_ACR_USERNAME` | 阿里云 ACR 用户名 | 阿里云 ACR 控制台 |
| `ALIYUN_ACR_PASSWORD` | 阿里云 ACR 密码 | 阿里云 ACR 控制台 |
| `DEPLOY_HOST` | 生产服务器 IP | 服务器提供商 |
| `DEPLOY_USER` | SSH 用户（建议 `deploy`） | 服务器配置 |
| `DEPLOY_SSH_KEY` | SSH 私钥（建议 ED25519） | `ssh-keygen -t ed25519` |
| `SLACK_WEBHOOK_URL` | Slack 通知 Webhook（可选） | Slack App |

### 3.4 镜像仓库选择

| 方案 | 国内拉取速度 | 免费额度 | 推荐度 |
|------|------------|---------|--------|
| **阿里云 ACR（个人版）** | 极快 | 3 个命名空间，无限镜像 | **推荐** |
| 腾讯云 TCR | 快 | 500 个镜像 | 备选 |
| Docker Hub | 慢/不稳定 | 无限公开镜像 | 不推荐（国内服务器） |
| GitHub Container Registry | 中等 | 无限公开镜像 | 备选 |

**阿里云 ACR 初始化：**

```bash
# 1. 创建命名空间
aliyun cr CreateNamespace --NamespaceName chefgame

# 2. 创建镜像仓库
aliyun cr CreateRepository \
  --RepoName chef-game \
  --Namespace chefgame \
  --Summary "合合小厨神后端"

# 3. 获取临时登录密码（或创建 RAM 子账号用于 CI/CD）
aliyun cr GetAuthorizationToken
```

---

## 4. 发布流程

### 4.1 后端：滚动更新方案

本项目为单体架构，使用 Docker Compose 的 `--scale` 实现零停机滚动更新。

**滚动更新脚本（`deploy/scripts/rolling-update.sh`）：**

```bash
#!/bin/bash
# 用法：./rolling-update.sh registry.cn-hangzhou.aliyuncs.com/chefgame/chef-game:v1.0.0-42
set -euo pipefail

NEW_IMAGE="${1:?请指定新镜像地址}"
COMPOSE_DIR="/opt/chef-game"
HEALTHCHECK_URL="http://localhost:8080/actuator/health"
MAX_WAIT=120

cd "$COMPOSE_DIR"

echo "=== 开始滚动更新 ==="
echo "新镜像: $NEW_IMAGE"
echo "时间: $(date -Iseconds)"

# Step 1: 拉取新镜像
echo "[1/5] 拉取新镜像..."
docker pull "$NEW_IMAGE"

# Step 2: 给新镜像打 tag
docker tag "$NEW_IMAGE" chef-game:new
OLD_IMAGE=$(docker inspect chef-game:latest --format '{{.RepoTags}}' 2>/dev/null || echo "none")
echo "旧镜像: $OLD_IMAGE"

# Step 3: 启动新实例（扩容到 2 个）
echo "[2/5] 启动新实例..."
APP_VERSION=new docker compose up -d --no-deps --scale app=2 app

# Step 4: 等待新实例健康
echo "[3/5] 等待新实例就绪..."
for i in $(seq 1 $MAX_WAIT); do
    if curl -sf "$HEALTHCHECK_URL" > /dev/null 2>&1; then
        echo "新实例健康检查通过 (${i}s)"
        break
    fi
    if [ "$i" -eq "$MAX_WAIT" ]; then
        echo "ERROR: 新实例健康检查超时！开始回滚..."
        docker tag chef-game:latest chef-game:rollback
        APP_VERSION=latest docker compose up -d --no-deps --scale app=1 app
        exit 1
    fi
    sleep 1
done

# Step 5: 缩容到 1 个实例，保持新版本
echo "[4/5] 切换流量..."
docker tag chef-game:new chef-game:latest
APP_VERSION=latest docker compose up -d --no-deps --scale app=1 app

# 清理
echo "[5/5] 清理旧版本..."
docker image prune -a --filter "until=2h" -f

echo "=== 滚动更新完成 ==="
echo "当前版本: $(docker inspect chef-game:latest --format '{{.Id}}')"
```

**关键时间节点：**

```
时刻 T+0s:    启动新实例（并行运行 2 个 app 容器）
时刻 T+5s:    新实例开始接收健康检查
时刻 T+30s:   新实例健康检查通过，Nginx 开始轮询分发到新实例
时刻 T+35s:   停止旧实例，流量 100% 到新实例
停机窗口:     0 秒（Nginx keepalive 连接复用，旧实例处理完现有请求后退出）
```

### 4.2 前端：小程序发布流程

**发布流程概览：**

```
开发版 ──▶ 体验版 ──▶ 审核版 ──▶ 灰度发布 ──▶ 全量发布
  │           │          │           │            │
  │           │     1-7 个工作日     │  1-24h     │
  │           │     (微信审核)       │ (灰度观察)  │
  └─── 开发者工具上传 ──┘            └── 数据正常 ──┘
```

**详细步骤：**

#### Step 1：代码上传

```bash
# 在微信开发者工具中：
# 1. 点击「上传」按钮
# 2. 版本号：v1.0.0（与 Git tag 一致）
# 3. 项目备注：本次更新的功能点（如"v1.0.0 初始版本"）
# 4. 确认上传
```

#### Step 2：提交审核

在微信公众平台 → 管理 → 版本管理：
1. 选择刚上传的「开发版本」
2. 点击「提交审核」
3. 填写审核信息：
   - **服务类目**：游戏 → 休闲游戏
   - **配置功能页**：确认已配置服务器域名
   - **测试账号**：提供测试用的微信账号（如审核人员无法登录）
   - **功能截图**：上传首页、核心玩法、设置页截图
   - **备注**：说明游戏核心玩法和广告展示场景

#### Step 3：灰度发布

审核通过后，在「审核版本」中点击「发布」：

| 灰度比例 | 持续时间 | 观察指标 |
|---------|---------|---------|
| 5% | 2 小时 | 错误率、crash 率 |
| 20% | 6 小时 | 广告填充率、API 错误率 |
| 50% | 12 小时 | 全面观察 |
| 100% | — | 确认无误后全量 |

**灰度期间重点监控：**
- 微信后台「运营数据」→ 错误率是否 < 0.5%
- 服务端 `/actuator/metrics` → 5xx 错误数
- 广告平台 → 填充率是否正常
- 用户反馈（微信客服消息）

#### Step 4：全量发布

确认灰度无异常后，在版本管理中将灰度比例调至 100%。

### 4.3 发布 Checklist

**发布前 30 分钟：**

- [ ] 确认 `.env` 中所有密钥已填写真实值（非占位符）
- [ ] 确认数据库迁移脚本已执行（`docker compose exec app java -jar app.jar --spring.flyway.migrate`）
- [ ] 确认 HTTPS 证书有效（`openssl s_client -connect api.chefgame.cn:443 -servername api.chefgame.cn </dev/null 2>/dev/null | openssl x509 -noout -dates`）
- [ ] 确认小程序服务器域名已配置
- [ ] 确认优量汇广告位 ID 已替换占位符
- [ ] 确认健康检查端点返回 200
- [ ] 通知团队：发布窗口开始，暂停手动操作

**发布中（滚动更新期间）：**

- [ ] 观察新实例健康检查是否通过
- [ ] 观察 `docker compose logs -f --tail=100 app` 无异常日志
- [ ] curl 测试核心接口：`curl -s https://api.chefgame.cn/actuator/health`
- [ ] 观察 Nginx 错误日志：`docker compose logs nginx | grep ERROR`

**发布后 1 小时内：**

- [ ] 观察服务端错误率 < 1%
- [ ] 观察广告填充率正常
- [ ] 观察数据库慢查询无异常增长
- [ ] 用真实微信账号登录测试
- [ ] 确认合成/订单/广告核心流程可用
- [ ] 确认小程序审核版本已提交

---

## 5. 回滚方案

### 5.1 后端回滚

**方案 A：Docker 镜像回滚（推荐，秒级）**

```bash
#!/bin/bash
# deploy/scripts/rollback.sh
set -euo pipefail

COMPOSE_DIR="/opt/chef-game"

# 列出最近 5 个版本的镜像
echo "最近部署的版本："
docker images chef-game --format "table {{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | head -6

read -p "输入要回滚到的版本号: " ROLLBACK_TAG

cd "$COMPOSE_DIR"

# 打标签
docker tag "chef-game:${ROLLBACK_TAG}" chef-game:rollback

# 确认
read -p "确认回滚到 ${ROLLBACK_TAG}? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "已取消"
    exit 0
fi

# 执行回滚（与滚动更新类似）
APP_VERSION=rollback docker compose up -d --no-deps --scale app=2 app
sleep 10
APP_VERSION=rollback docker compose up -d --no-deps --scale app=1 app
docker tag chef-game:rollback chef-game:latest

echo "回滚完成：当前运行版本 ${ROLLBACK_TAG}"

# 验证
sleep 5
if curl -sf http://localhost:8080/actuator/health > /dev/null; then
    echo "健康检查通过"
else
    echo "WARNING: 健康检查失败！请手动排查"
fi
```

**方案 B：docker-compose 整体回滚（备选）**

```bash
# 如果滚动更新失败且新容器无法启动
cd /opt/chef-game

# 停止当前容器
docker compose down app

# 使用上一个已知良好的镜像
docker tag chef-game:previous-stable chef-game:latest
docker compose up -d app
```

**回滚决策矩阵：**

| 触发条件 | 回滚方式 | RTO（恢复时间目标） |
|---------|---------|-------------------|
| 新版本启动失败 | 方案 A（镜像回滚） | < 30s |
| 新版本运行后 5xx 错误率 > 5% | 方案 A（镜像回滚） | < 30s |
| Docker daemon 异常 | 方案 B（整体回滚） | < 5min |
| 宿主机不可用 | 切到备用服务器 + DNS 切流 | < 15min |

### 5.2 前端回滚

**微信小程序版本回退：**

在微信公众平台 → 管理 → 版本管理：
1. 找到当前线上版本
2. 点击「版本回退」
3. 选择上一个稳定版本
4. 确认回退（立即生效，用户下次打开小程序时自动更新）

**注意事项：**
- 回退对用户透明（用户无需手动操作）
- 微信客户端会在 12 小时内逐步拉取回退版本
- 回退后的版本号会显示为「版本回退」
- 一个月内限制回退次数（建议 < 3 次）

**紧急情况：暂停服务**

在微信公众平台 → 管理 → 版本管理 → 点击「暂停服务」
- 用户打开小程序时看到"小游戏维护中"
- 不影响审核流程

### 5.3 数据库回滚

**策略：优先使用向前修复（Forward Migration），避免 Undo。**

```bash
# Flyway 迁移管理命令
# 查看迁移状态
docker compose exec app java -jar app.jar flyway:info

# 如果 V2 有破坏性变更，创建一个 V3 来修复（向前修复）
# 而不是用 Flyway Undo（需要 Flyway Teams 付费版）
```

**破坏性变更的 forward migration 示例：**

```sql
-- V1__init.sql: 创建表
-- V2__add_column.sql: ALTER TABLE user ADD COLUMN phone VARCHAR(20);
-- 如果 V2 有问题，不回退，而是创建 V3：

-- V3__fix_column.sql
ALTER TABLE user MODIFY COLUMN phone VARCHAR(32);      -- 扩宽字段
-- 或
ALTER TABLE user DROP COLUMN phone;                      -- 按需删除
```

**数据备份恢复（如误删数据）：**

```bash
# 1. 确认误操作的时间点
# 2. 从最近的全量备份恢复
gunzip < /data/chef-game/backups/db/chef_game_20260531_020000.sql.gz | \
  docker exec -i chef-game-mysql mysql -u root -p"$DB_ROOT_PASSWORD" chef_game

# 3. 从 Binlog 恢复到误操作前的时间点
docker exec chef-game-mysql mysqlbinlog \
  --start-datetime="2026-05-31 02:00:00" \
  --stop-datetime="2026-05-31 14:30:00" \
  /var/lib/mysql/binlog.000001 | \
  docker exec -i chef-game-mysql mysql -u root -p"$DB_ROOT_PASSWORD"
```

---

## 6. 监控方案

### 6.1 监控架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         监控架构                                  │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │ 微信后台  │   │ Grafana  │   │  Prometheus│   │  ELK / 云日志 │ │
│  │ (小程序)  │   │ (仪表盘)  │   │ (指标采集) │   │ (日志聚合)    │ │
│  └────┬─────┘   └────┬─────┘   └─────┬──────┘   └──────┬───────┘ │
│       │              │              │                  │          │
│       ▼              ▼              ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Spring Boot 应用                          │ │
│  │  /actuator/health          (健康检查)                        │ │
│  │  /actuator/metrics          (指标) ──▶ Prometheus 格式       │ │
│  │  /actuator/prometheus       (Prometheus 端点)                │ │
│  │  stdout 日志                (JSON 格式) ──▶ Filebeat/云服务  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 应用健康检查端点

```bash
# 基础健康检查
curl https://api.chefgame.cn/actuator/health
# 响应：
# {"status":"UP","components":{"db":{"status":"UP"},"redis":{"status":"UP"},"diskSpace":{"status":"UP"}}}

# 详细指标（需认证）
curl https://api.chefgame.cn/actuator/metrics

# Prometheus 格式指标
curl https://api.chefgame.cn/actuator/prometheus
```

### 6.3 关键指标（KPI）

| 指标 | 数据源 | 正常范围 | 告警阈值 |
|------|--------|---------|---------|
| **QPS** | `http.server.requests` | < 100 | > 500（扩容信号） |
| **P95 响应时间** | `http.server.requests` | < 100ms | > 500ms |
| **5xx 错误率** | `http.server.requests` | 0% | > 1% |
| **4xx 错误率** | `http.server.requests` | < 2% | > 5% |
| **JVM 堆内存使用率** | `jvm.memory.used` | < 70% | > 85% |
| **DB 连接池使用率** | `hikaricp.connections.active` | < 50% | > 80% |
| **Redis 连接池使用率** | `lettuce.connections` | < 50% | > 80% |
| **广告填充率** | 优量汇后台 | > 80% | < 50% (收入预警) |
| **能量/金币异常** | 自定义指标 | 0 | > 0 (作弊告警) |
| **磁盘使用率** | `disk.free` | > 20% | < 10% |

### 6.4 自定义业务指标

```java
// 在应用代码中添加 Micrometer 自定义指标
@Component
public class GameMetrics {

    private final MeterRegistry meterRegistry;

    // 能量异常次数（反作弊）
    private final Counter energyAnomalyCount;

    // 金币异常次数（反作弊）
    private final Counter goldAnomalyCount;

    // 广告回调成功率
    private final Counter adCallbackSuccess;
    private final Counter adCallbackFailure;

    public GameMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;

        this.energyAnomalyCount = Counter.builder("game.energy.anomaly")
            .description("能量异常次数")
            .register(meterRegistry);

        this.goldAnomalyCount = Counter.builder("game.gold.anomaly")
            .description("金币异常次数")
            .register(meterRegistry);

        this.adCallbackSuccess = Counter.builder("game.ad.callback.success")
            .description("广告回调成功")
            .register(meterRegistry);

        this.adCallbackFailure = Counter.builder("game.ad.callback.failure")
            .description("广告回调失败")
            .register(meterRegistry);

        // 同时注册到全局 HashMap 供健康检查端点使用
        Gauge.builder("game.users.online", this, m -> getOnlineCount())
            .description("在线用户数")
            .register(meterRegistry);
    }

    public void recordEnergyAnomaly(String uid) {
        energyAnomalyCount.increment();
    }

    public void recordGoldAnomaly(String uid) {
        goldAnomalyCount.increment();
    }

    public void recordAdCallback(boolean success) {
        if (success) adCallbackSuccess.increment();
        else adCallbackFailure.increment();
    }

    private long getOnlineCount() {
        // 从 Redis 统计活跃会话
        return 0L; // 实际实现时替换
    }
}
```

### 6.5 日志收集方案

**推荐：应用输出 JSON 格式到 stdout → Docker log driver 收集 → 云日志服务**

**Logback 配置（`src/main/resources/logback-spring.xml`）：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <!-- 生产环境：JSON 格式输出到 stdout -->
    <appender name="JSON_CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeContext>false</includeContext>
            <fieldNames>
                <timestamp>timestamp</timestamp>
                <message>message</message>
                <level>level</level>
                <logger>logger</logger>
            </fieldNames>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="JSON_CONSOLE"/>
    </root>
</configuration>
```

Maven 依赖：

```xml
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

**日志收集方案对比：**

| 方案 | 成本 | 运维难度 | 推荐场景 |
|------|------|---------|---------|
| **阿里云 SLS** | 按量付费，~0.2 元/GB | 低（开箱即用） | **推荐，与 ECS 同厂商** |
| 腾讯云 CLS | 按量付费，~0.2 元/GB | 低 | 如用腾讯云 |
| ELK 自建 | 服务器成本（2C4G ~200元/月） | 高 | 有专职运维时 |
| Docker log driver → SLS | 低 | 低 | 最简单 |

**阿里云 SLS 集成（Logtail Docker 插件）：**

```yaml
# docker-compose.yml 中 app 服务添加
  app:
    # ... 其他配置 ...
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
        tag: "chef-game-app"
    # 阿里云 Logtail 会自动采集 /var/lib/docker/containers/*/*.log
```

### 6.6 告警规则

**Prometheus + AlertManager 告警规则（`deploy/prometheus/alerts.yml`）：**

```yaml
groups:
  - name: chef_game_alerts
    rules:
      # ---- 服务可用性 ----
      - alert: ServiceDown
        expr: up{job="chef-game"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "服务宕机"
          description: "chef-game 健康检查失败超过 1 分钟"

      # ---- 错误率 ----
      - alert: HighErrorRate
        expr: |
          sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
          /
          sum(rate(http_server_requests_seconds_count[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "5xx 错误率 > 1%"
          description: "当前 5xx 错误率 {{ $value | humanizePercentage }}"

      # ---- 广告收入骤降 ----
      - alert: AdRevenueDrop
        expr: |
          rate(game_ad_callback_success_total[1h])
          /
          rate(game_ad_callback_success_total[1h] offset 24h) < 0.7
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "广告收入骤降 > 30%"
          description: "过去 1 小时广告回调成功数相比昨日同时段下降 {{ $value | humanizePercentage }}"

      # ---- 能量金币异常 ----
      - alert: EnergyGoldAnomaly
        expr: rate(game_energy_anomaly_total[10m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "能量/金币异常增长"
          description: "检测到可能的作弊行为，10 分钟内异常次数 {{ $value }}"

      # ---- JVM 内存 ----
      - alert: HighMemoryUsage
        expr: jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"} > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "JVM 堆内存使用率 > 85%"

      # ---- 磁盘空间 ----
      - alert: LowDiskSpace
        expr: disk_free_bytes{path="/"} / disk_total_bytes{path="/"} < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "磁盘剩余空间 < 10%"
```

**告警通知渠道：**

| 渠道 | 告警级别 | 通知方式 |
|------|---------|---------|
| **企业微信/钉钉群** | Warning | @运维人员 |
| **短信** | Critical | 阿里云短信服务 |
| **电话** | Critical + 持续 10 分钟 | PagerDuty / 阿里云语音通知 |
| **Slack** | 全部 | 机器人 Webhook |

---

## 7. 上线前最终检查清单

### 7.1 安全（Security）

- [ ] **JWT 密钥已配置环境变量** — `echo $JWT_SECRET` 不为空且不等于默认值
  - 检查命令：`docker compose exec app sh -c 'echo $JWT_SECRET'`
- [ ] **JWT 密钥长度 ≥ 256 位** — `echo $JWT_SECRET | base64 -d | wc -c` ≥ 32
- [ ] **广告验签密钥已配置** — `YLH_SECRET_KEY` 已从优量汇后台获取并填入 `.env`
- [ ] **HTTPS 已启用** — `curl -I https://api.chefgame.cn` 不返回 `301` 或 `Connection refused`
  - 检查命令：`curl -sI https://api.chefgame.cn/actuator/health | head -1` 应返回 `HTTP/2 200`
- [ ] **SSL 证书有效期检查** — 距过期时间 > 30 天
  - 检查命令：`echo | openssl s_client -servername api.chefgame.cn -connect api.chefgame.cn:443 2>/dev/null | openssl x509 -noout -dates`
- [ ] **HSTS 头已配置** — `curl -sI https://api.chefgame.cn | grep -i "strict-transport-security"`
- [ ] **数据库密码与 root 密码不同** — `DB_PASSWORD != DB_ROOT_PASSWORD`
- [ ] **Redis requirepass 已启用** — `REDIS_PASSWORD` 不为空
- [ ] **SSH 端口非默认 22**（建议改为 2222 或其他）
- [ ] **防火墙规则** — 仅开放 80/443/SSH 端口
  ```bash
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 2222/tcp   # SSH（已修改端口）
  ufw enable
  ```
- [ ] **MySQL 不绑定到公网 IP** — `netstat -tlnp | grep 3306` 仅监听 `127.0.0.1` 或 Docker 内网
- [ ] **Git 仓库中无敏感文件** — `.env` 文件在 `.gitignore` 中
  ```bash
  # 检查是否有密码硬编码在代码中
  grep -r "password\|secret\|key" 04-code/backend/src --include="*.java" --include="*.yml" | grep -v "variable\|env\|placeholder\|secret_key\|secretKey"
  ```

### 7.2 数据库（Database）

- [ ] **数据库迁移已执行** — Flyway 状态检查无 pending migration
  - 检查命令：`docker compose exec app sh -c 'java -jar app.jar --spring.flyway.migrate'`
- [ ] **索引已创建** — 确认关键表索引存在
  ```sql
  -- 在 MySQL 中执行
  SHOW INDEX FROM `user`;
  SHOW INDEX FROM `board_state`;
  SHOW INDEX FROM `merge_log`;
  SHOW INDEX FROM `order_log`;
  SHOW INDEX FROM `ad_watch_log`;
  -- 应与 02-architecture.md §5.3 索引设计一致
  ```
- [ ] **备份已配置** — crontab 中每日备份任务已设置
  ```bash
  crontab -l | grep backup
  # 应包含 backup-db.sh 和 backup-redis.sh
  ```
- [ ] **备份恢复已测试** — 最近一次备份已成功恢复到测试环境
- [ ] **慢查询日志已开启** — MySQL `slow_query_log=1`, `long_query_time=0.5`
- [ ] **字符集为 utf8mb4** — `docker compose exec mysql mysql -u chef -p"$DB_PASSWORD" -e "SELECT @@character_set_database, @@collation_database;"`
  - 预期结果：`utf8mb4 | utf8mb4_unicode_ci`

### 7.3 微信小程序（WeChat Mini Program）

- [ ] **request 合法域名已配置** — `https://api.chefgame.cn`
  - 微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名
- [ ] **uploadFile 合法域名已配置** — `https://api.chefgame.cn`
- [ ] **downloadFile 合法域名已配置** — `https://api.chefgame.cn`
- [ ] **socket 合法域名已配置** — `wss://api.chefgame.cn`（如需）
- [ ] **业务域名已配置** — 如使用 web-view
- [ ] **API 域名已完成 ICP 备案** — 微信强制要求
  - 检查：https://beian.miit.gov.cn/ 查询 `chefgame.cn`
- [ ] **app.json 中的 appid 正确** — 当前为 `wx884086128839f921`
- [ ] **小程序基础库最低版本设置正确** — `project.config.json` 中 `libVersion: "3.6.0"`

### 7.4 广告（Advertisement）

- [ ] **优量汇广告位 ID 已替换占位符** — 在 `04-code/frontend/services/ad.js` 中检查：
  - `adUnitId` 不应为 `adunit-xxxxxxxx` 这样的占位值
  - 激励视频、Banner、插屏广告位 ID 均为真实值
  ```bash
  grep -n "adunit-" 04-code/frontend/services/ad.js
  # 应无输出（所有占位符已替换）
  ```
- [ ] **优量汇回调 URL 已在广告平台配置** — `https://api.chefgame.cn/api/v1/ad/callback/ylh`
- [ ] **优量汇 Secret Key 已填写**
- [ ] **广告每日上限参数已确认** — `application.yml` 中：
  - `energy-ad-daily-limit: 10`
  - `ad-speedup-daily-limit: 8`

### 7.5 监控（Monitoring）

- [ ] **健康检查端点正常** — 返回 200 且包含 DB/Redis 状态
  ```bash
  curl -s https://api.chefgame.cn/actuator/health | python3 -m json.tool
  # 预期：{"status":"UP","components":{"db":{"status":"UP"},"redis":{"status":"UP"},"diskSpace":{"status":"UP"}}}
  ```
- [ ] **日志输出到 stdout** — Docker logs 可正常查看
  ```bash
  docker compose logs --tail=20 app
  # 应能看到 HTTP 请求日志
  ```
- [ ] **Prometheus metrics 端点可访问** — `/actuator/prometheus`
- [ ] **告警规则已配置** — Prometheus/AlertManager 规则已部署
- [ ] **告警通知渠道已验证** — 发送测试告警并确认收到

### 7.6 性能（Performance）

- [ ] **数据库连接池配置合理** — 生产环境 `maximum-pool-size: 20`
- [ ] **Redis 连接池配置合理** — `max-active: 16`
- [ ] **JVM 参数配置** — `-Xms256m -Xmx512m -XX:+UseG1GC`
- [ ] **Nginx gzip 已开启** — `curl -sI -H "Accept-Encoding: gzip" https://api.chefgame.cn/api/v1/auth/login | grep "Content-Encoding"`
- [ ] **Docker 日志限制已配置** — `max-size: 50m, max-file: 5`

### 7.7 业务（Business）

- [ ] **游戏配置参数已 Review** — `application.yml` 中所有 game.* 配置
  - 能量最大值 100、恢复间隔 3 分钟、初始金币 100
  - 棋盘大小 6×5、自动生成间隔 30 秒
- [ ] **微信登录流程可用** — 真实设备登录测试
- [ ] **合成/订单核心流程可用** — 完整走通 1 次游戏流程
- [ ] **排行榜数据正常** — Redis Sorted Set 中有测试数据
- [ ] **配置表已上传** — `config/recipes.json` 等版本号与后端一致

---

## 8. 成本估算

### 8.1 服务器配置建议

**V1.0 推荐配置（2C4G）：**

| 资源 | 配置 | 说明 |
|------|------|------|
| CPU | 2 核 | 1 核给 Java 应用，0.5 核给 MySQL，0.5 核给系统 |
| 内存 | 4 GB | Java 堆 512MB + MySQL 512MB + Redis 256MB + OS 2.5GB（余量） |
| 系统盘 | 40 GB SSD | OS + Docker 镜像 |
| 数据盘 | 50 GB SSD | MySQL 数据 + Redis 持久化 + 备份 |
| 带宽 | 3 Mbps | V1.0 万级 DAU，API 响应 < 3KB/请求，3Mbps 可支撑 ~120 QPS |
| 操作系统 | Ubuntu 22.04 LTS | Docker 兼容性最好 |

**V1.1 扩展建议（DAU > 5 万时）：**

| 资源 | V1.0 (2C4G) | V1.1 (4C8G) |
|------|------------|------------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 带宽 | 3 Mbps | 5-8 Mbps |
| 数据盘 | 50 GB | 100 GB |
| 适用 DAU | < 1 万 | 1-10 万 |

### 8.2 云厂商价格对比

**按 2C4G + 50GB 数据盘 + 3Mbps 带宽计算（2026 年参考价）：**

| 服务项目 | 阿里云 ECS | 腾讯云 CVM | 华为云 ECS |
|---------|-----------|-----------|-----------|
| **计算 (2C4G)** | ¥138/月 | ¥128/月 | ¥132/月 |
| **系统盘 (40GB SSD)** | ¥14/月 | ¥14/月 | ¥14/月 |
| **数据盘 (50GB SSD)** | ¥17.5/月 | ¥17.5/月 | ¥17.5/月 |
| **带宽 (3Mbps)** | ¥69/月 | ¥69/月 | ¥69/月 |
| **合计 (月)** | **~¥238.5/月** | **~¥228.5/月** | **~¥232.5/月** |

**附加服务费用：**

| 服务 | 阿里云 | 腾讯云 | 说明 |
|------|--------|--------|------|
| **MySQL 云数据库 (1C1G)** | ¥120/月 | ¥108/月 | 如果不用自建 MySQL |
| **Redis 云数据库 (1GB)** | ¥68/月 | ¥60/月 | 如果不用自建 Redis |
| **日志服务 SLS/CLS** | ~¥10/月 | ~¥10/月 | V1.0 日志量小 |
| **域名** | ¥60/年 | ¥60/年 | chefgame.cn |
| **SSL 证书** | 免费 (Let's Encrypt) | 免费 (Let's Encrypt) | — |
| **对象存储 (50GB)** | ¥6/月 | ¥5.5/月 | 静态资源/备份归档 |

### 8.3 总成本预估

**方案 A：自建 MySQL + Redis（推荐 V1.0，最省钱）**

| 项目 | 月费 |
|------|------|
| ECS 2C4G (阿里云/腾讯云) | ¥235 |
| 域名 | ¥5 |
| 日志服务 | ¥10 |
| 对象存储（备份归档） | ¥6 |
| **合计** | **~¥256/月** |

**方案 B：云数据库（高可用，省运维）**

| 项目 | 月费 |
|------|------|
| ECS 2C4G (仅跑应用) | ¥235 |
| MySQL 云数据库 1C1G | ¥114 |
| Redis 云数据库 1GB | ¥64 |
| 域名 | ¥5 |
| 日志服务 | ¥10 |
| 对象存储 | ¥6 |
| **合计** | **~¥434/月** |

**方案 C：微信云托管（免运维，锁平台）**

| 项目 | 月费 |
|------|------|
| 云托管 1C2G + 0.5C1G MySQL | ~¥300/月 |
| 流量费（按量） | ~¥20/月 |
| **合计** | **~¥320/月** |

### 8.4 推荐方案

**V1.0 推荐方案 A（自建 Docker Compose）**，理由：
- 月费最低（~¥256），年费约 ¥3072
- 项目已有完整 Docker Compose 配置，运维成本可控
- V1.0 DAU 万级以内，单机性能完全够用
- DB/Redis 自建在数据量小的阶段没有瓶颈

**后续升级路径：**
1. DAU 破 1 万 → 升级 ECS 到 4C8G（+¥150/月）
2. DAU 破 5 万 → 迁移 MySQL 到云数据库（+¥114/月）
3. DAU 破 10 万 → 迁移 Redis 到云数据库 + 应用横向扩展到 2 实例（+¥64 + ¥235/月）

---

## 附录 A：服务器初始化脚本

**一键初始化新服务器（`deploy/scripts/init-server.sh`）：**

```bash
#!/bin/bash
# 用法：在全新 Ubuntu 22.04 上以 root 执行
# curl -fsSL https://raw.githubusercontent.com/.../init-server.sh | bash
set -euo pipefail

echo "=== 合合小厨神 — 服务器初始化 ==="

# 1. 基础依赖
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git vim htop ufw fail2ban unzip

# 2. 创建 deploy 用户
useradd -m -s /bin/bash deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
# 将 CI/CD SSH 公钥写入（手动操作或从 secrets 注入）
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..." > /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# 3. Docker 安装
curl -fsSL https://get.docker.com | bash
systemctl enable docker
usermod -aG docker deploy

# 4. Docker Compose 安装
curl -L "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 5. 防火墙
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 2222/tcp        # SSH 改为 2222 端口
ufw --force enable
sed -i 's/^#Port 22/Port 2222/' /etc/ssh/sshd_config
systemctl restart sshd

# 6. Fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 2222
maxretry = 3
bantime = 3600
EOF
systemctl enable fail2ban && systemctl restart fail2ban

# 7. 创建应用目录
mkdir -p /opt/chef-game /data/chef-game/{backups,ssl,certbot}
chown -R deploy:deploy /opt/chef-game /data/chef-game

# 8. 系统参数优化
cat >> /etc/sysctl.conf << 'EOF'
# 合合小厨神优化
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
vm.swappiness = 10
vm.overcommit_memory = 1
EOF
sysctl -p

echo "=== 初始化完成 ==="
echo "请手动完成："
echo "1. 将 deploy 用户 SSH 公钥写入 /home/deploy/.ssh/authorized_keys"
echo "2. 复制 .env 文件到 /opt/chef-game/.env"
echo "3. 申请 SSL 证书（参考 07-deployment.md §2.3）"
echo "4. 配置 crontab 备份任务"
```

## 附录 B：快速命令参考

```bash
# 启动所有服务
docker compose up -d

# 查看运行状态
docker compose ps

# 查看应用日志
docker compose logs -f --tail=100 app

# 重启应用（保留数据）
docker compose restart app

# 完全重建（保留 volumes 数据）
docker compose down && docker compose up -d

# 进入应用容器调试
docker compose exec app sh

# 进入 MySQL
docker compose exec mysql mysql -u chef -p"$DB_PASSWORD" chef_game

# 进入 Redis
docker compose exec redis redis-cli -a "$REDIS_PASSWORD"

# 查看健康检查状态
curl -s http://localhost:8080/actuator/health | python3 -m json.tool

# SSL 证书剩余天数
echo | openssl s_client -servername api.chefgame.cn -connect api.chefgame.cn:443 2>/dev/null | openssl x509 -noout -dates

# 查看镜像列表
docker images chef-game --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# 清理 24 小时前的旧镜像
docker image prune -a --filter "until=24h" -f
```
