import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/server/db';
import { fetchOfficial, type OfficialDraw } from '@/modules/lottery/provider';
import {
  cutoff,
  dateValue,
  dayString,
  drawDay,
  lotteryNames,
  ticketSchema,
  type Lottery,
} from '@/modules/lottery/schema';
import { evaluate, type Prizes } from '@/modules/lottery/matching';
import { smtpConfig } from '@/modules/mail/server/settings';

/** 固定预计日历只提供追踪截止点；不生成官方期号，休市以实际公告为准。 */
export async function ensureCalendar() {
  const today = dateValue(dayString());
  for (let offset = 0; offset <= 35; offset++) {
    const date = new Date(today.getTime() + offset * 86400000);
    const str = date.toISOString().slice(0, 10);
    for (const lottery of ['SSQ', 'DLT'] as const)
      if (drawDay(lottery, str))
        await db.draw.upsert({
          where: { lottery_date: { lottery, date } },
          create: { lottery, date, scheduledAt: cutoff(str) },
          update: {},
        });
  }
}
const configSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
  effectiveFrom: z.string(),
  targetDate: z.string().optional(),
  kind: z.enum(['FIXED', 'TEMP']),
  recipients: z.array(z.string()),
  purchased: z.boolean(),
});
/** 以截止前最后一个完整配置版本形成快照。后续编辑不能改写历史投注。 */
export async function freezeDraw(draw: { id: string; lottery: Lottery; date: Date; scheduledAt: Date }) {
  if (draw.scheduledAt > new Date()) return;
  const groups = await db.numberGroup.findMany({
    where: { lottery: draw.lottery, createdAt: { lte: draw.scheduledAt } },
    include: {
      versions: { where: { createdAt: { lte: draw.scheduledAt } }, orderBy: { version: 'desc' }, take: 1 },
    },
  });
  const config = await smtpConfig();
  const date = draw.date.toISOString().slice(0, 10);
  for (const group of groups) {
    const version = group.versions[0];
    if (!version) continue;
    const state = configSchema.parse(version.configuration);
    if (
      state.status !== 'ACTIVE' ||
      state.effectiveFrom > date ||
      (state.kind === 'TEMP' && state.targetDate !== date)
    )
      continue;
    await db.snapshot.upsert({
      where: { groupId_drawId: { groupId: group.id, drawId: draw.id } },
      create: {
        groupId: group.id,
        groupVersionId: version.id,
        drawId: draw.id,
        tickets: version.tickets!,
        purchased: state.purchased,
        recipients: state.recipients.length ? state.recipients : (config?.recipients ?? []),
      },
      update: {},
    });
  }
}
export async function freezeDue() {
  const draws = await db.draw.findMany({
    where: { scheduledAt: { lte: new Date(), gte: new Date(Date.now() - 32 * 86400000) } },
    orderBy: { scheduledAt: 'asc' },
  });
  for (const draw of draws) await freezeDraw(draw);
}
/** 同一号码的奖金补全不制造新开奖版本；冲突结果保留证据并停止自动通知。 */
export async function ingest(row: OfficialDraw) {
  if (cutoff(row.date) > new Date()) return;
  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        main: [...row.numbers.main].sort((a, b) => a - b),
        special: [...row.numbers.special].sort((a, b) => a - b),
      }),
    )
    .digest('hex');
  const saved = await db.$transaction(async (tx) => {
    const draw = await tx.draw.upsert({
      where: { lottery_date: { lottery: row.lottery, date: dateValue(row.date) } },
      create: {
        lottery: row.lottery,
        issue: row.issue,
        date: dateValue(row.date),
        scheduledAt: cutoff(row.date),
      },
      update: {},
    });
    const versions = await tx.drawVersion.findMany({ where: { drawId: draw.id } });
    const conflict =
      draw.status === 'CONFLICT' ||
      (draw.issue !== null && draw.issue !== row.issue) ||
      versions.some((v) => v.checksum !== checksum);
    const previous = versions.find((v) => v.checksum === checksum);
    const prizes = { ...((previous?.prizes as Prizes) ?? {}), ...row.prizes };
    const version = await tx.drawVersion.upsert({
      where: { drawId_checksum: { drawId: draw.id, checksum } },
      create: { drawId: draw.id, checksum, numbers: row.numbers, prizes, source: row.source },
      update: { prizes },
    });
    const updated = await tx.draw.update({
      where: { id: draw.id },
      data: {
        issue: draw.issue ?? row.issue,
        status: conflict ? 'CONFLICT' : 'CONFIRMED',
        ...(!conflict ? { numbers: row.numbers, prizes, source: row.source } : {}),
        checkedAt: new Date(),
      },
    });
    if (conflict)
      await tx.mailJob.updateMany({
        where: { kind: 'AUTO', status: 'PENDING', key: { startsWith: `auto:${draw.id}:` } },
        data: { status: 'CANCELLED', error: '官方号码发生冲突，停止发送' },
      });
    return { draw: updated, version };
  });
  if (saved.draw.status !== 'CONFIRMED') return;
  await freezeDraw(saved.draw);
  const snapshots = await db.snapshot.findMany({
    where: { drawId: saved.draw.id },
    include: { group: { select: { name: true, status: true } } },
  });
  const config = await smtpConfig();
  for (const snapshot of snapshots) {
    const tickets = z.array(ticketSchema).parse(snapshot.tickets);
    const result = evaluate(row.lottery, tickets, row.numbers, saved.version.prizes as Prizes, row.date);
    await db.$transaction(async (tx) => {
      const match = await tx.matchRecord.upsert({
        where: { snapshotId_drawVersionId: { snapshotId: snapshot.id, drawVersionId: saved.version.id } },
        create: { snapshotId: snapshot.id, drawVersionId: saved.version.id, ...result },
        update: result,
      });
      const key = `auto:${saved.draw.id}:${snapshot.id}`;
      if (result.winning !== true || result.totalAmount === null) {
        await tx.mailJob.updateMany({
          where: { key, status: 'PENDING' },
          data: { status: 'CANCELLED', error: '奖金条件变化，停止尚未投递的通知' },
        });
      }
      if (
        !config?.autoEnabled ||
        snapshot.group.status !== 'ACTIVE' ||
        !snapshot.recipients.length ||
        result.winning !== true ||
        result.totalAmount === null
      )
        return;
      const text = [
        `${lotteryNames[row.lottery]} 第 ${row.issue} 期 · ${row.date}`,
        `号码组：${snapshot.group.name}`,
        `合计中奖：${result.totalAmount} 元（税前）`,
        snapshot.purchased
          ? '已标记购买；请以官方兑奖结果为准'
          : '仅为追踪号码的理论奖金，不代表已购买或实际收益',
        ...result.details.map(
          (d, i) =>
            `第 ${i + 1} 注：${d.ticket.main.join(' ')} | ${d.ticket.special.join(' ')} · ${d.tier ?? '未中奖'} · ${d.amount} 元`,
        ),
      ].join('\n');
      await tx.mailJob.upsert({
        where: { key },
        create: {
          key,
          groupId: snapshot.groupId,
          kind: 'AUTO',
          subject: `中奖通知 · ${snapshot.group.name} · ${result.totalAmount} 元`,
          payload: { recipients: snapshot.recipients, text, matchId: match.id },
        },
        update: {},
      });
      // 官方同号码奖金更正只能更新尚未发送的内容，不悄悄改写已发邮件日志。
      await tx.mailJob.updateMany({
        where: { key, status: 'PENDING' },
        data: {
          subject: `中奖通知 · ${snapshot.group.name} · ${result.totalAmount} 元`,
          payload: { recipients: snapshot.recipients, text, matchId: match.id },
        },
      });
    });
  }
}
/** 每个彩种独立同步，单一官方站点故障不妨碍另一个彩种。 */
export async function synchronize() {
  await ensureCalendar();
  await freezeDue();
  const outcomes: string[] = [];
  for (const lottery of ['SSQ', 'DLT'] as const) {
    try {
      const rows = await fetchOfficial(lottery);
      for (const row of rows) await ingest(row);
      outcomes.push(`${lotteryNames[lottery]}：同步 ${rows.length} 期`);
    } catch {
      outcomes.push(`${lotteryNames[lottery]}：官方暂不可用`);
    }
  }
  await db.setting.upsert({
    where: { key: 'lastSync' },
    create: { key: 'lastSync', value: { at: new Date().toISOString(), outcomes } },
    update: { value: { at: new Date().toISOString(), outcomes } },
  });
  return outcomes;
}
