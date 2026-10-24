import 'server-only';
import { db } from '@/server/db';
import { requireActor, groupScope } from '@/server/permissions';
import { querySchema } from '@/modules/lottery/schema';
import { throttle } from '@/server/security';
import { audit } from '@/server/audit';
import { synchronize } from './engine';

export async function getDraws(input: unknown, calendar = false) {
  await requireActor('draws.read');
  const q = querySchema.parse(input);
  const where = {
    lottery: q.lottery,
    ...(calendar ? {} : { status: q.status === 'CONFLICT' ? ('CONFLICT' as const) : ('CONFIRMED' as const) }),
    ...(q.q ? { issue: { contains: q.q } } : {}),
    ...(q.from || q.to
      ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
      : {}),
  };
  const [rows, total] = await db.$transaction([
    db.draw.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: calendar ? 0 : (q.page - 1) * 20,
      take: calendar ? 100 : 20,
      select: {
        id: true,
        lottery: true,
        issue: true,
        date: true,
        status: true,
        numbers: true,
        prizes: true,
        checkedAt: true,
      },
    }),
    db.draw.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      checkedAt: r.checkedAt?.toISOString() ?? null,
    })),
  };
}
export async function syncDraws() {
  const actor = await requireActor('draws.write');
  await throttle('official-sync', 60);
  const outcomes = await synchronize();
  await audit(actor.id, 'draw.sync', null, { outcomes });
  return outcomes;
}
export async function dashboard() {
  const actor = await requireActor('groups.read');
  const matchWhere = {
    snapshot: { group: groupScope(actor) },
    drawVersion: { draw: { status: 'CONFIRMED' as const } },
  };
  const [groups, draws, matches, paid, unknown, recent, lastSync] = await Promise.all([
    db.numberGroup.count({ where: { ...groupScope(actor), status: 'ACTIVE' } }),
    db.draw.count({ where: { status: 'CONFIRMED' } }),
    db.matchRecord.aggregate({ where: matchWhere, _sum: { totalAmount: true } }),
    db.matchRecord.aggregate({
      where: { ...matchWhere, snapshot: { group: groupScope(actor), purchased: true } },
      _sum: { totalAmount: true },
    }),
    db.matchRecord.count({ where: { ...matchWhere, totalAmount: null } }),
    db.matchRecord.findMany({
      where: matchWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        totalAmount: true,
        winning: true,
        snapshot: {
          select: {
            group: { select: { name: true } },
            draw: { select: { date: true, lottery: true, issue: true } },
            purchased: true,
          },
        },
      },
    }),
    db.setting.findUnique({ where: { key: 'lastSync' } }),
  ]);
  return {
    groups,
    draws,
    total: matches._sum.totalAmount?.toFixed(2) ?? '0.00',
    purchasedTotal: paid._sum.totalAmount?.toFixed(2) ?? '0.00',
    unknown,
    lastSync: lastSync?.value ?? null,
    recent: recent.map((m) => ({
      id: m.id,
      name: m.snapshot.group.name,
      date: m.snapshot.draw.date.toISOString().slice(0, 10),
      lottery: m.snapshot.draw.lottery,
      issue: m.snapshot.draw.issue,
      amount: m.totalAmount?.toFixed(2) ?? null,
      winning: m.winning,
      purchased: m.snapshot.purchased,
    })),
  };
}
