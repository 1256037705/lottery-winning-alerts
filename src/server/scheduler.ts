import 'server-only';
import { db } from './db';
import { synchronize } from '@/modules/draws/server/engine';
import { deliverPending } from '@/modules/mail/server/service';
const state = globalThis as unknown as { lotteryTimer?: ReturnType<typeof setInterval> };
/** 数据库租约覆盖多实例；任务有明确超时，不在 HTTP 请求中无限等待。 */
async function acquire(key: string, seconds: number) {
  const expiresAt = new Date(Date.now() + seconds * 1000);
  if (
    (await db.jobLease.updateMany({ where: { key, expiresAt: { lt: new Date() } }, data: { expiresAt } }))
      .count
  )
    return true;
  try {
    await db.jobLease.create({ data: { key, expiresAt } });
    return true;
  } catch {
    return false;
  }
}
async function tick() {
  try {
    if (await acquire('sync', 300)) await synchronize();
    if (await acquire('delivery', 120)) {
      try {
        await deliverPending();
      } finally {
        await db.jobLease.update({ where: { key: 'delivery' }, data: { expiresAt: new Date() } });
      }
    }
  } catch (e) {
    console.error('Scheduler failed', e instanceof Error ? e.name : 'UnknownError');
  }
}
export function startScheduler() {
  if (!state.lotteryTimer) {
    state.lotteryTimer = setInterval(() => void tick(), 60000);
    state.lotteryTimer.unref();
    void tick();
  }
}
