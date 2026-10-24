import 'server-only';
import { z } from 'zod';
import { requireActor, groupScope } from '@/server/permissions';
import { db } from '@/server/db';
import { audit } from '@/server/audit';
import { groupSchema, querySchema, dateValue, cutoff, dayString, drawDay } from '@/modules/lottery/schema';
import { BusinessError } from '@/lib/errors';
import { findGroup, listGroups } from './repository';
import { freezeDue } from '@/modules/draws/server/engine';

export async function getGroups(kind: 'FIXED' | 'TEMP', input: unknown) {
  return listGroups(await requireActor('groups.read'), kind, querySchema.parse(input));
}
/** 号码变更与版本记录、审计同事务提交，避免并发覆盖。 */
export async function saveGroup(input: unknown) {
  const actor = await requireActor('groups.write');
  const data = groupSchema.parse(input);
  if (
    data.kind === 'TEMP' &&
    (!drawDay(data.lottery, data.targetDate!) || cutoff(data.targetDate!) <= new Date())
  )
    throw new BusinessError('请选择该彩种尚未截止的预计开奖日；官方休市以公告为准');
  if (!data.id && data.effectiveFrom < dayString())
    throw new BusinessError('新号码不能追溯到创建前的开奖日期');
  await freezeDue();
  const { tickets, id, version, ...fields } = data;
  const normalized = tickets.map((t) => ({
    main: [...t.main].sort((a, b) => a - b),
    special: [...t.special].sort((a, b) => a - b),
  }));
  return db.$transaction(async (tx) => {
    const record = {
      ...fields,
      effectiveFrom: dateValue(fields.effectiveFrom),
      targetDate: fields.targetDate ? dateValue(fields.targetDate) : null,
    };
    if (id) {
      const existing = await tx.numberGroup.findFirst({ where: { id, ...groupScope(actor) } });
      if (!existing) throw new BusinessError('号码组不存在', 'NOT_FOUND');
      if (existing.status === 'ARCHIVED') throw new BusinessError('已删除号码组不能编辑', 'CONFLICT');
      if (existing.lottery !== data.lottery || existing.kind !== data.kind)
        throw new BusinessError('编辑时不能改变彩种或号码类型');
      const result = await tx.numberGroup.updateMany({
        where: { id, version, ...groupScope(actor), status: { not: 'ARCHIVED' } },
        data: { ...record, version: { increment: 1 } },
      });
      if (!result.count) throw new BusinessError('号码已被其他操作更新，请刷新后重试', 'CONFLICT');
      await tx.groupVersion.create({
        data: {
          groupId: id,
          version: version! + 1,
          tickets: normalized,
          configuration: { ...fields, status: existing.status },
        },
      });
      await audit(actor.id, 'group.update', id, { version: version! + 1 }, tx);
      return id;
    }
    const group = await tx.numberGroup.create({
      data: {
        ...record,
        ownerId: actor.id,
        versions: {
          create: { version: 1, tickets: normalized, configuration: { ...fields, status: 'ACTIVE' } },
        },
      },
    });
    await audit(actor.id, 'group.create', group.id, { kind: data.kind }, tx);
    return group.id;
  });
}
export async function changeGroup(input: unknown) {
  const actor = await requireActor('groups.write');
  const { id, version, status } = z
    .object({
      id: z.string().min(1),
      version: z.number().int(),
      status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
    })
    .parse(input);
  await freezeDue();
  await db.$transaction(async (tx) => {
    const existing = await tx.numberGroup.findFirst({
      where: { id, ...groupScope(actor) },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!existing) throw new BusinessError('记录不存在', 'NOT_FOUND');
    const changed = await tx.numberGroup.updateMany({
      where: { id, version, ...groupScope(actor), status: { not: 'ARCHIVED' } },
      data: { status, version: { increment: 1 }, archivedAt: status === 'ARCHIVED' ? new Date() : null },
    });
    if (!changed.count) throw new BusinessError('记录不存在、已删除或版本冲突', 'CONFLICT');
    const previous = existing.versions[0];
    await tx.groupVersion.create({
      data: {
        groupId: id,
        version: version + 1,
        tickets: previous.tickets!,
        configuration: { ...(previous.configuration as Record<string, string>), status },
      },
    });
    if (status !== 'ACTIVE')
      await tx.mailJob.updateMany({
        where: { groupId: id, status: 'PENDING', kind: 'AUTO' },
        data: { status: 'CANCELLED' },
      });
    await audit(actor.id, `group.${status.toLowerCase()}`, id, {}, tx);
  });
}
export async function groupHistory(id: unknown) {
  const actor = await requireActor('groups.read');
  const key = z.string().parse(id);
  if (!(await findGroup(actor, key))) throw new BusinessError('号码组不存在', 'NOT_FOUND');
  const rows = await db.groupVersion.findMany({
    where: { groupId: key },
    orderBy: { version: 'desc' },
    take: 100,
    select: { version: true, tickets: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
