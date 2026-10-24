# 数据库设计

PostgreSQL 18；Prisma 7。结构以 prisma/schema.prisma 和 migrations 为权威。

## 表关系

| 表 | 用途与约束 |
| --- | --- |
| User / Session / Account / Verification / RateLimit | Better Auth 账号、数据库会话、凭据与限流；Session token 唯一 |
| Role / Permission / UserRole / RolePermission | RBAC；关联表组合主键 |
| NumberGroup | 负责人、类型、彩种、状态、起始/目标日期、乐观锁 version |
| GroupVersion | (groupId, version) 唯一；号码与完整业务配置历史 |
| Draw | (lottery, date) 与 (lottery, issue) 唯一；官方期号允许未公布 |
| DrawVersion | (drawId, checksum) 唯一；不同号码证据不覆盖 |
| Snapshot | (groupId, drawId) 唯一；锁定版本、号码、购买标记和收件人 |
| MatchRecord | (snapshotId, drawVersionId) 唯一；Decimal(18,2) 奖金或 NULL |
| MailJob | 唯一幂等 key；发送状态与最小任务负载 |
| MailAttempt | (jobId, number) 唯一；记录每次发送状态 |
| Setting | SMTP 加密配置与最后同步摘要 |
| AuditEvent | 操作者、动作、对象、摘要及时间 |
| JobLease / ActionThrottle | 分布式租约、操作节流 |

## 一致性

- 核心历史表外键 onDelete: Restrict；号码删除为 ARCHIVED，不物理删除历史。
- 编辑通过 id + version + 数据范围原子更新，再创建新版本和审计，同事务完成。
- SQL 检查金额非负、版本为正、临时记录必须有目标日、号码为非空数组。
- 金额 NULL 意味待官方确认，不等同 0.00；汇总忽略 NULL 并单独显示待确认数。
- 业务日使用 DATE；具体时间用规范化 DateTime，显示 Asia/Shanghai。
- 对外只返回显式 DTO；不把整个 User/Account/Setting 发给浏览器。

## 迁移

001 建立模型、索引及外键；002 添加业务 CHECK。共享/生产应用后不得改写历史 SQL。本次迁移尚未应用到生产。

生产使用 pnpm db:deploy，不使用 db push 或 migrate dev。升级前备份数据库与 APP_ENCRYPTION_KEY；只有数据库备份没有密钥无法解密 SMTP。

## 历史兼容

新项目不读取旧版 SQLite。旧数据原样保留，测试夹具只存在独立 lottery_test 数据库。任何迁移旧号码/快照/邮件日志需要明确映射、演练、总数核对和独立迁移文档，当前未执行。
