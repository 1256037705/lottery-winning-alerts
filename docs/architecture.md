# 架构说明

## 模块化单体

一个常驻 Node.js Next.js 进程承载页面、Server Actions 和有界后台任务。PostgreSQL 是唯一核心业务库。Caddy 提供 HTTPS，数据库和应用端口不直接暴露。

```text
浏览器 → HTTPS Caddy → Next.js
                         ├─ Server Components → Service → Repository / Prisma
                         ├─ Server Actions → 验证身份/权限/输入 → Service
                         ├─ Better Auth Route Handler → Session / Account
                         └─ 定时同步与邮件租约 → 官方固定源 / SMTP
                                                   ↓
                                               PostgreSQL
```

## 分层

- src/app：路由、页面组合；服务端页面直接调用业务服务。
- src/components：主题、导航、筛选、页码、号码球、状态标签。
- src/modules/groups：号码 Schema、Actions、业务服务、带范围限制的 Repository。
- src/modules/lottery：纯日期/号码校验、纯判奖、官方源解析及有界请求。
- src/modules/draws：开奖摄取、版本证据、追踪快照、匹配和仪表盘查询。
- src/modules/mail：SMTP 配置、加密、任务、投递与日志。
- src/server：数据库、认证、权限、审计、错误输出、任务调度。
- prisma：Schema 与审核后的迁移。
- tests：纯函数、真实隔离 PostgreSQL、浏览器 E2E。

普通查询不机械增加空转层；复杂的号码范围查询封装 Repository。所有敏感服务入口重新授权。后台引擎只有服务端内部可调用，不暴露公共无鉴权 API。

## 认证与权限

Better Auth 维护唯一会话来源；数据库读取用户的角色与权限。管理员具有 groups.readAll，否则 DAL 限定 ownerId。登录请求限流存在数据库，不依赖单进程内存。Server Actions 的框架同源保护与服务端授权共同生效。

## 定时处理

instrumentation 只在 NODE_RUNTIME=nodejs 且 SCHEDULER_ENABLED=true 时注册。每分钟检查；同步租约 300 秒；邮件租约 120 秒。官方调用单次 15 秒超时、响应 2 MB 上限、固定 URL 不跟随重定向。每轮最多投递 3 个任务。

每封邮件先原子声明 SENDING。进程崩溃留下的过期 SENDING 转 UNCERTAIN，绝不假设“没有记录成功就是未发送”。SMTP 不可能由应用单方面保证端到端 exactly-once。

## 密钥与安全

APP_ENCRYPTION_KEY 为独立 32 字节 AES-GCM 密钥；SMTP 密码以随机 IV 加密，密文不进入客户端 DTO。生产 Auth 密钥、加密密钥、数据库密码由部署脚本随机生成；构建仅使用进程内临时密钥，运行时仍必须提供真实配置。

当前 SMTP 支持 TLS 465 或强制 STARTTLS 587，校验证书，不开放明文 SMTP。系统日志仅保留错误类别和业务摘要，不记录密码、Cookie 或 SMTP 响应原文。

## 扩展限制

当前追踪群组数量适合个人/小团队内部使用。量级增长前需测量轮询批次耗时并拆分游标批处理；不得直接把租约超时无限调大。多实例唯一约束保证幂等，但首版推荐单应用实例。官方返回冲突后不自动裁决；保留版本，需经维护者核实后单独实施受审计修复。
