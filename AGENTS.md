# AGENTS.md — 公司内部综合业务管理系统（Next.js 全栈单体版）

> 本文件是 Codex 等编程智能体的项目级长期规则，适用本仓库。每次任务都要以当前仓库实际代码和明确需求为准；发现本文件与已稳定运行的实现存在冲突，应先说明，禁止擅自推倒重写。

## 0. 项目背景与架构总则

- 单家公司内部 Web 综合业务管理系统，**单租户**，面向多部门、多岗位、多角色员工。
- 仅有一名维护者，主要借助 AI 完成设计、编码和测试。优先保证安全、可维护、可验证、部署简单。
- **单个 Next.js 全栈项目 + PostgreSQL**：代码中严格分离 UI、服务端入口、业务规则、数据访问，但初期作为一个应用部署。
- 采用**模块化单体**；不使用微服务、独立 NestJS/Django/FastAPI 业务后端。
- 先实现可运行、可验收的业务闭环；不得凭空增加未经确认的业务模块和规则。
- 默认用简体中文沟通和写面向人的文档；代码命名、类型、API 字段采用一致的英文。

## 1. 固定技术栈

| 层次 | 选择 |
| --- | --- |
| Web 全栈框架 | Next.js App Router（Node.js 运行时） |
| 语言 | TypeScript，开启 `strict` |
| UI | React + Ant Design；复杂表格/表单可按需用 ProComponents |
| 图表 | Apache ECharts（客户端组件、按需加载） |
| 数据库 | PostgreSQL（唯一核心业务数据库） |
| ORM 与迁移 | Prisma ORM + Prisma Migrate |
| 输入校验 | Zod 或项目已有成熟校验方案（默认 Zod） |
| 身份管理 | 项目统一、成熟的认证/Session 方案（新项目优先评估 Auth.js）；必须明确实现方式并验证兼容性 |
| 测试 | Vitest（单元/服务层）、Playwright（E2E）；数据库集成测试使用隔离测试库 |
| 工程 | pnpm + ESLint + TypeScript + GitHub Actions（可按部署环境调整） |
| 部署 | Docker 或可靠托管 Node.js 服务；PostgreSQL 独立部署/托管 |

- 不引入 Django、FastAPI、NestJS、第二套 ORM 或第二个数据库写入服务。
- 不默认引入 Redux、Redis、Kafka、RabbitMQ、Kubernetes；除非有已验证的需求与明确收益。
- 依赖版本和配置必须与当前 Next.js、React、Prisma、Ant Design 版本兼容；查项目锁文件与官方文档，不依赖过时记忆。

## 2. 最重要的服务端/客户端边界

- **Server Components**：主要用于需要服务端数据的页面和首次读取，直接调用服务端业务服务/数据访问层；不要为了内部读取而向自身 `/api` 发 HTTP 请求。
- **Client Components**：交互组件、表单、表格交互、图表及浏览器 API；仅在需要时声明 `'use client'`，不把整个应用默认变成客户端组件。
- **Server Actions**：主要处理本 Web 应用发起的写操作；每次必须独立做身份验证、授权、输入校验和错误处理。
- **Route Handlers**：提供外部 API、Webhooks、文件下载、特定客户端数据请求等 HTTP 接口；同样必须独立认证、授权与限流。
- **Service 层**：持有业务规则、状态转换、事务和审计协调；UI/Actions/Handlers 不应直接承载完整业务规则。
- **Repository/DAL 层**：封装 Prisma 查询、数据范围限制和最小字段选择；敏感数据不能流向浏览器。
- `src/server/` 下的服务端模块按需使用 `server-only` 约束；**Prisma Client、数据库连接串、密钥绝不能进入浏览器 Bundle**。
- 不要只在 Layout、前端导航或页面按钮中检查权限；Server Actions、Route Handlers 和敏感读写操作均需检查。

## 3. 推荐目录结构（避免为目录而无谓重构）

```text
business-system/
├── AGENTS.md
├── README.md
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── ui-guidelines.md
│   ├── decisions/
│   └── business-rules/
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── customers/
│   │   │   ├── orders/
│   │   │   └── settings/
│   │   └── api/               # 对外 HTTP 接口、Webhooks、导出等
│   ├── modules/               # 按业务领域封装
│   │   ├── customers/
│   │   │   ├── components/
│   │   │   ├── schema.ts
│   │   │   ├── actions.ts
│   │   │   └── server/
│   │   │       ├── service.ts
│   │   │       └── repository.ts
│   │   ├── orders/
│   │   └── workflow/
│   ├── server/
│   │   ├── auth/
│   │   ├── permissions/
│   │   ├── db/
│   │   ├── audit/
│   │   └── storage/
│   ├── components/            # 跨模块复用 UI
│   └── lib/                   # 无服务端机密的通用工具
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── integration/
│   └── e2e/
├── Dockerfile
└── package.json
```

- 上述为目标组织形式，新仓库可按此创建；既有仓库优先沿用合理结构。
- 业务域拥有自己的页面、类型、输入 Schema、Service、Repository、测试；不要把所有业务逻辑集中在 `lib/utils.ts`。
- 避免过度抽象：不为普通 CRUD 机械创建多层空类；真正有复杂业务规则时保持边界明确。

## 4. UI 与可视化规范

- 统一 Ant Design 企业管理后台风格：左侧导航、顶部工具区、内容区；以可读性、操作效率、视觉一致性为先。
- 默认主题建议：主色 `#1677FF`、背景 `#F5F7FA`、内容卡片白色；通过 `ConfigProvider` Design Tokens 集中配置，不零散覆盖 Ant Design 内部样式。
- 普通列表用 `Table`，复杂业务列表可用 `ProTable`；表单用 `Form`/`ProForm`；小范围编辑使用 `Modal`/`Drawer`，复杂单据使用独立页面。
- ECharts 为唯一主图表库；统一格式化金额、日期、百分比和单位；图表必须有加载/空数据/失败状态，并考虑小屏适配。
- Ant Design 在 Next.js App Router 下按与项目版本兼容的官方方式配置样式注册（通常 `@ant-design/nextjs-registry`）。
- 所有数据列表应包含适当的 Loading、Empty、Error、Forbidden 状态；危险操作需二次确认并提供清楚的结果反馈。
- 不为了追求不同的视觉风格混入 Material UI、shadcn/ui、Recharts 等第二套主要组件/图表体系。

## 5. 身份认证、授权与数据范围

- 整个应用只保留**一套权威身份与 Session 机制**。认证库与账号模型先评估并固定，切忌临时拼接自制 Cookie/Session 加密方案。
- 会话 Cookie 使用合适的 `HttpOnly`、`Secure`（生产）、`SameSite` 设置；服务端完成密码哈希和会话验证；修改数据的入口防范 CSRF 等跨站风险。
- RBAC（角色—权限）是基础，涉及业务数据时添加部门/负责人等数据范围过滤；单租户不代表无需对象级权限。
- 每次写请求、敏感详情查询和列表查询都要在服务端进行权限与数据范围检查；UI 按钮隐藏仅改善体验。
- 不可仅依赖 Layout 或中间层做授权，必须在**靠近数据访问的位置**进行确定性校验。
- 管理员、审批、导出、财务等功能遵循最小权限；重要操作可追踪操作者、对象、时间和结果。

## 6. PostgreSQL 与 Prisma 规范

- 使用 Prisma Schema 和 Prisma Migrate 管理结构；禁止直接操作生产库架构或随意使用 `db push` 替代受审查的迁移流程。
- 开发环境允许按文档生成新迁移；**生产环境只通过经批准的发布流程应用 `prisma migrate deploy`**，不在生产执行 `migrate dev`。
- 设计外键、唯一约束、索引及必要的业务状态约束；数据库也要承担一致性保护，不能只依赖 UI 校验。
- 金额、税率等使用 Prisma `Decimal`/PostgreSQL `numeric`，避免 JavaScript 浮点金额误差；对外 JSON 采用稳定、明确的字符串/格式策略。
- 多表写入使用 Prisma Transaction；并发下的库存、编号、审批应结合数据库唯一约束、隔离等级/并发控制，且必须测试冲突场景。
- 核心模型按需记录 `createdAt`、`updatedAt`、操作者；时间存储规范化，显示层处理用户时区。
- 保持迁移向前兼容；已在共享环境执行的历史迁移不可随意编辑；删除列、批量改写数据等必须先备份并审批。
- 不必为单家公司引入 `tenantId`；多部门、多法人或不同核算主体是独立的业务建模问题。
- 附件放在 S3 兼容对象存储中；数据库保存元信息与权限；上传/下载验证大小、类型、所属记录和访问范围。

## 7. 输入、接口和安全规则

- 外部输入在服务端使用 Zod 等进行运行时验证；TypeScript 类型检查不等于运行时安全。
- 使用明确的 DTO，不把整条数据库记录（特别是密码哈希、敏感字段）直接传给客户端。
- HTTP API 遵循一致的状态码、分页、排序与错误结构；外部 Webhook 需验证签名并防重放；非幂等写操作不盲目自动重试。
- 关键业务状态转换统一在 Service 层；审批、金额、库存、财务等操作需验证身份、角色、数据范围和操作前置条件。
- 日志中不写明文密码、Token、密钥、会话 Cookie 和不必要的个人数据；错误响应不包含数据库凭据、堆栈或内部 SQL。
- 不将任何密钥写入 `NEXT_PUBLIC_*`；真实 `.env` 不提交，`.env.example` 只能写占位符。
- 长时间处理（大批量导出、AI 文档分析、定时同步）不能假定 Web 请求可以无限运行；真正需要时再提出独立 Worker 和幂等/重试设计。

## 8. AI 工作流程（按任务风险执行）

1. **理解**：阅读本文件、相关 docs、真实代码和测试；确认影响范围。不要以不存在的文件或函数作为事实。
2. **判断**：日常修复和小功能直接实施；涉及系统架构、认证方案、破坏性迁移、重大权限变化和大规模重构，先提交简短方案取得确认。
3. **实现**：最小必要改动，优先复用现有组件与模块；不要顺带修改无关功能、追加依赖或升级大版本。
4. **校验**：运行当前仓库支持的类型检查、Lint、单元/集成测试、构建；关键业务流程运行 Playwright。
5. **汇报**：列出主要变更、实际执行的命令及结果、未验证项、风险、人工需要操作的事情。

### 遇到不明确的业务需求

- 不要自行设定价格计算、税制、审批条件、库存生效时点、财务结算和数据访问范围。
- 普通 UI 细节可采用可维护的默认值；凡可能造成数据损坏、权限泄漏或业务金额错误的歧义，应先确认。

## 9. 验收标准（Definition of Done）

- 需求涉及的页面、服务端规则、数据库变更、权限验证、业务异常与测试都已覆盖。
- 不能把“按钮不显示”当作权限测试；必须验证越权 API/Server Action/数据读取确实被拒绝。
- 至少测试：成功路径、校验失败、权限不足、找不到资源；涉及事务与并发时增加冲突及回滚测试。
- 前端交互必须有加载、错误、空状态；敏感操作有审计信息和清晰反馈。
- 实际执行仓库提供的 TypeScript 类型检查、Lint、Vitest、构建、Playwright（按适用性）；失败不得删测试/跳过规则掩盖。
- 没有实际运行的检查不得声称通过。未完成或未验证时，明确记录。

## 10. 新建项目时首先完成什么

- 新仓库先创建 Next.js App Router + TypeScript 基础应用，安装 Ant Design 并确认首屏样式/交互正常；PostgreSQL 和 Prisma 配置可在本地启动。
- 固定认证方案与 User/Role/Permission 基础模型，保证服务端权限检查可测试，再开始业务模块。
- 建立服务端 `db`、`auth`、`permissions`、`audit` 的最小能力以及客户模块的**示例读写闭环**，而不是批量生成几十个空业务模块。
- 提供 `.env.example`、本地启动说明、迁移指令、必要测试脚本、Docker 部署与备份方案。
- 创建 `docs/architecture.md`、`docs/ui-guidelines.md`、`docs/business-rules/`；业务流程未确认前不生成未经证实的复杂功能。

## 11. 禁止未经明确授权的操作

- 不得修改/删除生产业务数据、重置生产数据库、执行危险迁移、上传真实客户数据至外部服务、部署上线或更改生产权限。
- 不擅自更换主框架、ORM、数据库、登录认证方案、UI 库或图表库。
- 不可因为一次错误就删除有价值的数据或文件；先诊断，再提供最小修复。
- 如无法确认操作目标是否是一次性测试环境，必须先问清楚。

## 12. 每次任务结束的报告模板

```text
完成内容：
主要修改文件：
数据库/接口/权限是否变化：
实际执行的检查和结果：
未完成项、风险或未验证项：
需要我确认/手动执行的事项：
```

> 长期目标：让一名维护者能够稳定地借助 AI 扩展内部业务系统。保持架构一致、服务端授权可靠、数据可恢复，始终优先于不必要的技术创新。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
