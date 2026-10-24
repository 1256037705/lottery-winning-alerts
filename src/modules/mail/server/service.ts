import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { db } from '@/server/db';
import { requireActor, groupScope } from '@/server/permissions';
import { audit } from '@/server/audit';
import { decrypt, throttle } from '@/server/security';
import { BusinessError } from '@/lib/errors';
import { findGroup } from '@/modules/groups/server/repository';
import { fetchOfficial } from '@/modules/lottery/provider';
import { evaluate } from '@/modules/lottery/matching';
import { lotteryNames, ticketSchema, querySchema, dayString, cutoff } from '@/modules/lottery/schema';
import { smtpConfig } from './settings';

const payloadSchema = z.object({
  recipients: z.array(z.email()).min(1).max(20),
  text: z.string().max(100000),
});
/** 手动测试取实时官方最新结果；不依赖本地开奖状态，不写入累计奖金。 */
export async function sendGroupTest(id: unknown) {
  const actor = await requireActor('mail.send');
  const group = await findGroup(actor, z.string().parse(id));
  if (!group || group.status === 'ARCHIVED') throw new BusinessError('号码组不存在', 'NOT_FOUND');
  await throttle(`test:${actor.id}:${group.id}`);
  const config = await smtpConfig();
  if (!config) throw new BusinessError('请先配置邮件设置');
  const latest = (await fetchOfficial(group.lottery)).find(
    (d) => d.date <= dayString() && cutoff(d.date) <= new Date(),
  );
  if (!latest) throw new BusinessError('官方尚无可用开奖结果', 'UNAVAILABLE');
  const tickets = z.array(ticketSchema).parse(group.versions[0]?.tickets);
  const result = evaluate(group.lottery, tickets, latest.numbers, latest.prizes, latest.date);
  const text = [
    `手动号码测试（不计入累计中奖）`,
    `号码组：${group.name}`,
    `${lotteryNames[group.lottery]} 第 ${latest.issue} 期 / ${latest.date}`,
    `开奖号码：${latest.numbers.main.join(' ')} | ${latest.numbers.special.join(' ')}`,
    `结果：${result.winning === true ? '中奖' : result.winning === false ? '未中奖' : '待官方奖金确认'}`,
    `合计奖金：${result.totalAmount === null ? '待官方公布，不能按 0 元处理' : result.totalAmount + ' 元'}`,
    ...result.details.map(
      (d, i) =>
        `第 ${i + 1} 注：${d.ticket.main.join(' ')} | ${d.ticket.special.join(' ')}；${d.tier ?? '未中奖'}；${d.amount === null ? '金额待确认' : d.amount + ' 元'}`,
    ),
    '金额为官方单注税前奖金；追踪不代表实际购买或兑奖。',
  ].join('\n');
  const job = await db.$transaction(async (tx) => {
    const created = await tx.mailJob.create({
      data: {
        key: `test:${randomUUID()}`,
        groupId: group.id,
        kind: 'TEST',
        subject: `[手动测试] ${group.name} · ${latest.issue}`,
        payload: { recipients: group.recipients.length ? group.recipients : config.recipients, text },
      },
    });
    await audit(actor.id, 'mail.test.enqueue', group.id, { jobId: created.id, issue: latest.issue }, tx);
    return created;
  });
  return {
    jobId: job.id,
    issue: latest.issue,
    date: latest.date,
    totalAmount: result.totalAmount,
    winning: result.winning,
  };
}
export async function testSmtp() {
  const actor = await requireActor('settings.write');
  await throttle(`smtp-test:${actor.id}`);
  const config = await smtpConfig();
  if (!config) throw new BusinessError('请先保存邮件配置');
  await db.$transaction(async (tx) => {
    const job = await tx.mailJob.create({
      data: {
        key: `smtp:${randomUUID()}`,
        kind: 'SMTP_TEST',
        subject: '开奖追踪 · SMTP 测试',
        payload: { recipients: config.recipients, text: '邮件配置测试成功。本邮件不是中奖通知。' },
      },
    });
    await audit(actor.id, 'smtp.test.enqueue', job.id, {}, tx);
  });
}
/** SMTP 不支持端到端幂等。发送中崩溃或不确定响应转 UNCERTAIN，避免盲目重发。 */
export async function deliverPending() {
  if (process.env.MAIL_DELIVERY_ENABLED !== 'true') return;
  const config = await smtpConfig();
  if (!config) return;
  await db.mailJob.updateMany({
    where: { status: 'SENDING', leaseUntil: { lt: new Date() } },
    data: { status: 'UNCERTAIN', error: '发送过程被中断，请先检查收件箱；系统不会自动重发' },
  });
  const jobs = await db.mailJob.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });
  for (const job of jobs) {
    if (job.kind === 'AUTO' && !config.autoEnabled) continue;
    const claimed = await db.mailJob.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'SENDING', leaseUntil: new Date(Date.now() + 90000), attemptCount: { increment: 1 } },
    });
    if (!claimed.count) continue;
    const attempt = await db.mailAttempt.create({
      data: { jobId: job.id, number: job.attemptCount + 1, status: 'SENDING' },
    });
    let status: 'SENT' | 'FAILED' | 'UNCERTAIN' = 'UNCERTAIN';
    let error: string | null = null;
    try {
      const payload = payloadSchema.parse(job.payload);
      const transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        requireTLS: config.port === 587,
        auth: { user: config.username, pass: decrypt(config.encryptedPassword) },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      });
      try {
        const response = await transport.sendMail({
          from: { name: config.senderName, address: config.from },
          to: payload.recipients,
          subject: job.subject,
          text: payload.text,
          messageId: `<${job.id}@lottery.internal>`,
        });
        if (response.rejected.length) {
          status = 'UNCERTAIN';
          error = '部分收件人被拒收，请检查发送结果';
        } else status = 'SENT';
      } finally {
        transport.close();
      }
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
      status = ['EAUTH', 'ECONNECTION', 'EDNS'].includes(code) ? 'FAILED' : 'UNCERTAIN';
      error =
        status === 'FAILED'
          ? 'SMTP 认证或连接失败，请检查配置'
          : '发送结果不确定，请检查收件箱；不会自动重发';
    }
    await db.$transaction([
      db.mailJob.update({
        where: { id: job.id },
        data: { status, error, sentAt: status === 'SENT' ? new Date() : null, leaseUntil: null },
      }),
      db.mailAttempt.update({ where: { id: attempt.id }, data: { status, error, finishedAt: new Date() } }),
    ]);
  }
}
export async function getMail(input: unknown, logs = false) {
  const actor = await requireActor('mail.read');
  const q = querySchema.parse(input);
  const allowed = ['PENDING', 'SENDING', 'SENT', 'FAILED', 'UNCERTAIN', 'CANCELLED'];
  const where = {
    ...(actor.permissions.includes('groups.readAll') ? {} : { group: { is: groupScope(actor) } }),
    ...(q.status && allowed.includes(q.status)
      ? { status: q.status as 'PENDING' }
      : logs
        ? { status: { not: 'PENDING' as const } }
        : {}),
    ...(q.q ? { subject: { contains: q.q } } : {}),
    ...(q.from || q.to
      ? {
          createdAt: {
            ...(q.from ? { gte: new Date(`${q.from}T00:00:00+08:00`) } : {}),
            ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00+08:00`).getTime() + 86400000) } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await db.$transaction([
    db.mailJob.findMany({
      where,
      select: {
        id: true,
        kind: true,
        subject: true,
        status: true,
        createdAt: true,
        sentAt: true,
        error: true,
        attemptCount: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * 20,
      take: 20,
    }),
    db.mailJob.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
    })),
  };
}
