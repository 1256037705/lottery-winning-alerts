import 'server-only';
import { db } from '@/server/db';
import { groupScope, type Actor } from '@/server/permissions';
import type { ListQuery } from '@/modules/lottery/schema';
import type { Prisma } from '@/generated/prisma/client';

/** 所有号码查询显式接收已鉴权操作者，避免遗漏对象范围。 */
export function groupWhere(actor: Actor, kind: 'FIXED' | 'TEMP', q: ListQuery): Prisma.NumberGroupWhereInput {
  return {
    ...groupScope(actor),
    kind,
    lottery: q.lottery,
    status: q.status === 'ARCHIVED' ? 'ARCHIVED' : q.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    ...(q.from || q.to
      ? {
          effectiveFrom: {
            ...(q.from ? { gte: new Date(q.from) } : {}),
            ...(q.to ? { lte: new Date(q.to) } : {}),
          },
        }
      : {}),
  };
}
export async function findGroup(actor: Actor, id: string) {
  return db.numberGroup.findFirst({
    where: { id, ...groupScope(actor) },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
}
export async function listGroups(actor: Actor, kind: 'FIXED' | 'TEMP', q: ListQuery) {
  const where = groupWhere(actor, kind, q);
  const [rows, total] = await db.$transaction([
    db.numberGroup.findMany({
      where,
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * 20,
      take: 20,
    }),
    db.numberGroup.count({ where }),
  ]);
  return {
    total,
    rows: rows.map(({ versions, ...g }) => ({
      id: g.id,
      name: g.name,
      lottery: g.lottery,
      kind: g.kind,
      status: g.status,
      version: g.version,
      effectiveFrom: g.effectiveFrom.toISOString().slice(0, 10),
      targetDate: g.targetDate?.toISOString().slice(0, 10),
      recipients: g.recipients,
      purchased: g.purchased,
      note: g.note,
      tickets: versions[0]?.tickets ?? [],
    })),
  };
}
