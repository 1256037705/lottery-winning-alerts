# ADR 001：认证与前后端边界

日期：2026-10-22；状态：已实现，本地验证中。

## 决策

采用 Better Auth 稳定版、Prisma adapter、数据库 Session、username 插件。所有用户写操作使用 Server Actions；认证 Route Handler 统一挂载 /api/auth/[...all]。

## 评估与理由

按 AGENTS.md 优先评估 Auth.js。其当前 Prisma + Next.js 教程仍采用 next-auth beta，账号密码场景需要额外考虑凭据验证与会话策略；本项目不需要 OAuth，要求稳定的用户名密码登录与数据库会话。因此选用具备对应一体化能力的 Better Auth，不自行实现 Cookie 签名或密码算法。

- [Auth.js / Prisma 官方教程](https://www.prisma.io/docs/guides/authentication/authjs/nextjs)
- [Better Auth Next.js 集成](https://better-auth.com/docs/integrations/next)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [用户名插件](https://better-auth.com/docs/plugins/username)
- [数据库限流](https://better-auth.com/docs/concepts/rate-limit)

## 安全结果

关闭公开注册；初始化命令只创建不存在的管理员，不改旧密码。密码由认证库的 hashPassword 处理。生产 Cookie Secure、HttpOnly、SameSite=Lax，要求 HTTPS。身份校验之后再从数据库读取权限；权限不从前端 Cookie 中自报。

首次局域网部署使用 Caddy 内部 CA，终端需安装并信任根证书；不能为了 HTTP 登录方便关闭 Secure Cookie。真实密钥不进入仓库，构建不复用生产密钥。

## 兼容性

Better Auth 和 Prisma adapter 固定为同版本；TypeScript/ESLint 固定到 Next 配套插件支持范围。ESLint 9 当前已标记不再受上游支持，但 Next 配套 React/import/a11y 插件 peer 范围尚不兼容 ESLint 10；暂保留兼容工具链，不忽略 peer 错误强行升级。后续工具链升级需要重新运行全部验证。
