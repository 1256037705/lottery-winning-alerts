import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/server/db';
/** 调用方可传入事务客户端；审计不接受密码、Session 或完整邮件正文。 */
export async function audit(
  actorId: string | null,
  action: string,
  entityId: string | null,
  detail: Prisma.InputJsonValue = {},
  tx: Prisma.TransactionClient = db,
) {
  await tx.auditEvent.create({ data: { actorId, action, entityId, detail } });
}
