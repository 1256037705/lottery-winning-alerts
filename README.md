# 自动推送彩票中奖提醒

彩票开奖追踪与中奖邮件通知系统，基于 Next.js、PostgreSQL 和 Docker Compose。仓库只包含可公开审查的源码与通用文档；真实地址、账号、密钥、SMTP 授权码、数据库及备份均不上传。

## 快速入口

- [产品需求 PRD](docs/PRD.md)
- [操作手册](docs/USER_GUIDE.md)
- [部署与回滚](docs/DEPLOYMENT.md)
- [架构说明](docs/architecture.md)
- [数据库设计](docs/database.md)
- [界面规范](docs/ui-guidelines.md)
- [业务规则](docs/business-rules/lottery.md)
- [认证决策](docs/decisions/001-auth.md)
- [测试及交付状态](docs/VERIFICATION.md)

## 技术栈

Next.js App Router / TypeScript strict / React / Ant Design / ECharts / PostgreSQL / Prisma Migrate / Better Auth 数据库会话 / Zod。具体版本以 package.json 和 pnpm-lock.yaml 为准，不自动追随 latest。

## 开发

要求 Node.js 24、pnpm 11.25.0。先安装依赖并生成 Prisma：

```sh
pnpm install --frozen-lockfile
pnpm db:generate
```

可使用独立 PostgreSQL 和 .env.example；生产凭据不得用于测试。

本机无 Docker 时，测试脚本可以启动仅监听回环地址的真实 PostgreSQL：

```sh
# 终端 A：保持运行。数据保存在被 Git 忽略的 test-artifacts/postgres。
pnpm test:db
# 终端 B：仅对固定的 lottery_test 数据库迁移、创建测试管理员。
pnpm test:setup
pnpm test:web
```

测试页面地址为 http://127.0.0.1:3100，测试账号配置在 tests/environment.ts，**绝不能用于生产**。该环境不启动同步或真实邮件投递。

## 校验

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

集成测试会清空专用 lottery_test 库中的合成业务数据。它通过固定数据库名、回环地址和端口隔离，不读取生产 .env。

## 部署

按 [部署手册](docs/DEPLOYMENT.md) 在自己的服务器上生成 `.env` 并配置 HTTPS 与 SMTP。请勿提交 `.env`、证书、数据库、备份或测试产物。
