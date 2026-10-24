import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { BusinessError } from '@/lib/errors';
export type Actor = { id: string; name: string; permissions: string[] };
/** 每个 Service 入口都调用；权限取自数据库，不能信任前端角色标签。 */
export async function requireActor(permission = 'app.read'): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new BusinessError('请先登录', 'UNAUTHORIZED');
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      roles: {
        select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
      },
    },
  });
  if (!user) throw new BusinessError('账号不存在', 'UNAUTHORIZED');
  const permissions = user.roles.flatMap((x) => x.role.permissions.map((p) => p.permission.code));
  if (!permissions.includes(permission)) throw new BusinessError('没有操作权限', 'FORBIDDEN');
  return { id: user.id, name: user.name, permissions };
}
export function groupScope(actor: Actor) {
  return actor.permissions.includes('groups.readAll') ? {} : { ownerId: actor.id };
}
