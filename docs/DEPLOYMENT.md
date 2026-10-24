# 部署、备份与回滚

本手册不包含任何特定服务器的地址、账号、证书指纹或密钥。请用自己的内网地址和安全渠道保存的凭据替换占位符。首次部署推荐使用隔离的 PostgreSQL 卷，并保持 `.env`、数据库、证书和备份在 Git 仓库之外。

## 前置条件

- Ubuntu 服务器已安装 Docker Engine 和 Compose 插件，SSH 可达，8443 端口未占用。
- 仅将 8443 绑定到 `LAN_BIND_IP` 指定的内网网卡；数据库不映射宿主机端口。
- Dockerfile 使用带 OpenSSL 与 CA 证书的 Node 基础镜像，以支持 Prisma 和外部 HTTPS/TLS。
- Docker 命令需要 Docker 权限；非 docker 组成员请自行加 `sudo`，不要为了部署扩大用户权限。

## 首次部署

将源码复制到服务器的新目录，排除 `.env`、`node_modules`、`.next`、`test-artifacts`、`test-results`、`playwright-report`、数据库、证书和备份。以下命令在项目目录执行：

```sh
cd /path/to/lottery-winning-alerts
# 宿主机已有 Node.js 24 时：
node scripts/init-env.mjs https://YOUR_LAN_IP:8443
# 宿主机无 Node.js 时，也可用临时 Node 容器运行同一脚本。
chmod 600 .env
docker compose --profile tools build
docker compose up -d db
docker compose --profile tools run --rm migrate
```

`init-env.mjs` 只在 `.env` 不存在时创建随机数据库、会话和 SMTP 加密密钥，不覆盖现有配置。请检查 `LAN_BIND_IP`、`SITE_ADDRESS`、`BETTER_AUTH_URL` 等值；首次部署的 `MAIL_DELIVERY_ENABLED=false`，避免在 SMTP 验收前真实投递。

迁移成功后初始化管理员。密码从隐藏终端输入，不写入命令历史或源码：

```sh
read -rs -p '管理员密码（至少12位）: ' BOOTSTRAP_PASSWORD
export BOOTSTRAP_PASSWORD
docker compose --profile tools run --rm -e BOOTSTRAP_PASSWORD migrate pnpm db:seed
unset BOOTSTRAP_PASSWORD
docker compose up -d app proxy
docker compose ps
```

如使用 `sudo`，应仅向这次初始化命令传递 `BOOTSTRAP_PASSWORD`；初始化脚本发现管理员已存在时不会重置旧密码。

## HTTPS 与客户端信任

Caddy 使用内部 CA 为内网地址签发证书。管理员可在服务器上导出公开根证书并通过可信渠道核对 SHA-256 指纹：

```sh
docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt ./lottery-next-root.crt
openssl x509 -in lottery-next-root.crt -noout -fingerprint -sha256
```

只分发根证书，不分发私钥；证书文件和实际指纹不提交 Git。客户端在核对指纹后自行信任根证书，不应通过关闭 TLS 校验或 Secure Cookie 来绕过问题。IP 访问可能不发送 SNI，Caddyfile 的 `default_sni` 使用 `LAN_BIND_IP`；改为域名时需同步调整配置。

## 验收与邮件

```sh
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{console.log(r.status,await r.text());if(!r.ok)process.exit(1)})"
docker compose logs --tail=80 app proxy
```

从已信任证书的客户端验证登录、号码录入、开奖同步和日历。不要在生产使用 `tests/environment.ts` 或运行集成测试。QQ 邮箱等 SMTP 参数在“邮件设置”页面填写；确认测试邮件后，才启用 `MAIL_DELIVERY_ENABLED=true` 和页面中的自动通知开关。环境变量改变后重建应用容器：

```sh
docker compose up -d --force-recreate app
```

自动邮件仅在确认中奖及奖金时发送；固定号码的“发送”是手动测试入口，不论中奖与否都发送一次。不要把真实授权码、收件地址或邮件日志提交到仓库。

## 升级、备份与回滚

升级前执行 `bash deploy/backup.sh`，校验数据库备份，并将备份和 `.env` 成对保存到离线加密位置。该脚本按自身位置定位项目目录，不依赖特定账户名。生产只执行审查过的 `prisma migrate deploy`，不运行 `migrate dev`、`db push` 或 `migrate reset`。

恢复时先在独立数据库或卷中验证备份，再在维护窗口切换；数据库与 `APP_ENCRYPTION_KEY` 必须成对恢复，否则既有 SMTP 密文无法解密。不要运行 `docker compose down -v`。镜像回滚也必须确认迁移向后兼容。
