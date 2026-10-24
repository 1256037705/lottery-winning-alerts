import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
/** 仅初始化不存在的管理员；重复执行不改已有账号密码或权限。 */
async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const username = process.env.BOOTSTRAP_USERNAME ?? 'admin';
    const email = process.env.BOOTSTRAP_EMAIL ?? 'admin@example.invalid';
    if (await db.user.findUnique({ where: { username } })) {
      console.log('管理员已存在，未作修改。');
      return;
    }
    const password = process.env.BOOTSTRAP_PASSWORD;
    if (!password || password.length < 12)
      throw new Error('首次初始化需要通过环境变量 BOOTSTRAP_PASSWORD 提供至少 12 位密码');
    const hashed = await hashPassword(password);
    const userId = randomUUID();
    await db.$transaction(async (tx) => {
      const codes = [
        'app.read',
        'groups.read',
        'groups.write',
        'groups.readAll',
        'draws.read',
        'draws.write',
        'mail.read',
        'mail.send',
        'settings.write',
      ];
      const role = await tx.role.upsert({ where: { name: 'ADMIN' }, create: { name: 'ADMIN' }, update: {} });
      for (const code of codes) {
        const p = await tx.permission.upsert({ where: { code }, create: { code }, update: {} });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
          create: { roleId: role.id, permissionId: p.id },
          update: {},
        });
      }
      const viewer = await tx.role.upsert({
        where: { name: 'VIEWER' },
        create: { name: 'VIEWER' },
        update: {},
      });
      for (const code of ['app.read', 'groups.read', 'draws.read', 'mail.read']) {
        const p = await tx.permission.findUniqueOrThrow({ where: { code } });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: viewer.id, permissionId: p.id } },
          create: { roleId: viewer.id, permissionId: p.id },
          update: {},
        });
      }
      await tx.user.create({
        data: {
          id: userId,
          name: username,
          username,
          displayUsername: username,
          email,
          emailVerified: true,
          accounts: {
            create: { id: randomUUID(), accountId: userId, providerId: 'credential', password: hashed },
          },
          roles: { create: { roleId: role.id } },
        },
      });
      await tx.auditEvent.create({
        data: { actorId: userId, action: 'system.bootstrap', entityId: userId, detail: {} },
      });
    });
    console.log('管理员初始化成功。');
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error('管理员初始化失败，请检查数据库及初始化环境变量。');
  process.exitCode = 1;
});
