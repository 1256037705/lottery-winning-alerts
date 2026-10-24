import 'server-only';
import { db } from '@/server/db';
import { requireActor } from '@/server/permissions';
export async function systemStatus() {
  await requireActor('settings.write');
  const [lastSync, events] = await Promise.all([
    db.setting.findUnique({ where: { key: 'lastSync' } }),
    db.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, entityId: true, createdAt: true, actor: { select: { name: true } } },
    }),
  ]);
  return {
    scheduler: process.env.SCHEDULER_ENABLED === 'true',
    delivery: process.env.MAIL_DELIVERY_ENABLED === 'true',
    lastSync: lastSync?.value ?? null,
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      entityId: e.entityId,
      createdAt: e.createdAt.toISOString(),
      actor: e.actor?.name ?? '系统',
    })),
  };
}
