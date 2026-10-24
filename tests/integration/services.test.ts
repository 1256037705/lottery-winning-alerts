import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { db } from '@/server/db';
import { requireActor } from '@/server/permissions';
import { saveGroup, changeGroup, getGroups } from '@/modules/groups/server/service';
import { ingest } from '@/modules/draws/server/engine';
import { deliverPending, sendGroupTest } from '@/modules/mail/server/service';
import { encrypt } from '@/server/security';
import type { OfficialDraw } from '@/modules/lottery/provider';
const state = vi.hoisted(() => ({
  userId: null as string | null,
  sendMail: vi.fn(),
  latest: [] as unknown[],
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/server/auth', () => ({
  auth: { api: { getSession: async () => (state.userId ? { user: { id: state.userId } } : null) } },
}));
vi.mock('@/modules/lottery/provider', () => ({ fetchOfficial: async () => state.latest }));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: state.sendMail, close: () => {} }) },
}));
const testId = `integration-${Date.now()}`;
let adminId = '';
let ownGroup = '';
const ticket = { main: [1, 2, 3, 4, 5, 6], special: [7] };
const input = {
  name: testId,
  lottery: 'SSQ',
  kind: 'FIXED',
  effectiveFrom: '2099-01-01',
  tickets: [ticket],
  recipients: ['test@example.invalid'],
  purchased: false,
};
const past: OfficialDraw = {
  lottery: 'SSQ',
  issue: '9990001',
  date: '2026-03-01',
  numbers: ticket,
  prizes: { 一等奖: '10.25' },
  source: 'https://www.cwl.gov.cn/',
};
beforeAll(async () => {
  const target = new URL(process.env.DATABASE_URL!);
  if (target.hostname !== '127.0.0.1' || target.pathname !== '/lottery_test')
    throw new Error('拒绝在非隔离库运行');
  // 本测试库是专门创建的隔离实例，清空合成业务夹具，不触及账号表或生产数据。
  await db.$executeRawUnsafe(
    'TRUNCATE "MailAttempt", "MailJob", "MatchRecord", "Snapshot", "DrawVersion", "Draw", "GroupVersion", "NumberGroup", "Setting", "ActionThrottle", "AuditEvent" CASCADE',
  );
  adminId = (await db.user.findUniqueOrThrow({ where: { username: 'testadmin' } })).id;
  const viewer = await db.role.findUniqueOrThrow({ where: { name: 'VIEWER' } });
  await db.user.create({
    data: {
      id: testId,
      name: testId,
      email: `${testId}@example.invalid`,
      roles: { create: { roleId: viewer.id } },
    },
  });
  const editor = await db.role.create({ data: { name: `${testId}-EDITOR` } });
  for (const code of ['app.read', 'groups.read', 'groups.write']) {
    const permission = await db.permission.findUniqueOrThrow({ where: { code } });
    await db.rolePermission.create({ data: { roleId: editor.id, permissionId: permission.id } });
  }
  await db.user.create({
    data: {
      id: `${testId}-writer`,
      name: '限定范围编辑者',
      email: `${testId}-writer@example.invalid`,
      roles: { create: { roleId: editor.id } },
    },
  });
});
beforeEach(() => {
  state.userId = adminId;
  state.sendMail.mockReset();
  state.sendMail.mockResolvedValue({ rejected: [] });
  process.env.MAIL_DELIVERY_ENABLED = 'false';
});
afterAll(async () => {
  await db.$disconnect();
});
describe('真实服务端鉴权和事务', () => {
  it('未登录拒绝读取和写入', async () => {
    state.userId = null;
    await expect(getGroups('FIXED', {})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(saveGroup(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('只读角色不能直接调用写服务', async () => {
    state.userId = testId;
    await expect(saveGroup(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(sendGroupTest('x')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('创建号码、版本及审计原子提交', async () => {
    ownGroup = await saveGroup(input);
    expect(await db.groupVersion.count({ where: { groupId: ownGroup } })).toBe(1);
    expect(await db.auditEvent.count({ where: { entityId: ownGroup } })).toBe(1);
  });
  it('其他用户看不到管理员的号码组', async () => {
    state.userId = testId;
    expect((await getGroups('FIXED', { q: testId })).total).toBe(0);
    await expect(requireActor('groups.read')).resolves.toMatchObject({ id: testId });
  });
  it('有写权限但无全局范围时，直接修改和删除别人的记录仍被拒绝', async () => {
    state.userId = `${testId}-writer`;
    await expect(saveGroup({ ...input, id: ownGroup, version: 1 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(changeGroup({ id: ownGroup, version: 1, status: 'ARCHIVED' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect((await db.numberGroup.findUniqueOrThrow({ where: { id: ownGroup } })).version).toBe(1);
  });
  it('不合法号码被拒绝', async () => {
    await expect(
      saveGroup({ ...input, name: 'bad', tickets: [{ ...ticket, special: [99] }] }),
    ).rejects.toThrow();
  });
  it('并发编辑只能成功一个，旧版本保留', async () => {
    const results = await Promise.allSettled([
      saveGroup({ ...input, id: ownGroup, version: 1, name: 'edit-a' }),
      saveGroup({ ...input, id: ownGroup, version: 1, name: 'edit-b' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.groupVersion.count({ where: { groupId: ownGroup } })).toBe(2);
  });
  it('不存在对象和删除流程有明确结果', async () => {
    await expect(saveGroup({ ...input, id: 'missing', version: 1 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await changeGroup({ id: ownGroup, version: 2, status: 'ARCHIVED' });
    expect((await db.numberGroup.findUniqueOrThrow({ where: { id: ownGroup } })).status).toBe('ARCHIVED');
    await expect(saveGroup({ ...input, id: ownGroup, version: 3 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});
describe('判奖、幂等和邮件安全', () => {
  let historical = '';
  let mailId = '';
  it('重复摄取只生成一次快照、匹配和中奖邮件', async () => {
    const config = {
      host: 'smtp.example.invalid',
      port: 465,
      username: 'test',
      from: 'test@example.invalid',
      senderName: '测试',
      recipients: ['test@example.invalid'],
      autoEnabled: true,
      encryptedPassword: encrypt('not-real'),
    };
    await db.setting.upsert({
      where: { key: 'smtp' },
      create: { key: 'smtp', value: config },
      update: { value: config },
    });
    const createdAt = new Date('2026-02-28T00:00:00Z');
    historical = (
      await db.numberGroup.create({
        data: {
          name: testId + '-history',
          lottery: 'SSQ',
          kind: 'FIXED',
          ownerId: adminId,
          effectiveFrom: new Date('2026-02-01'),
          createdAt,
          recipients: ['test@example.invalid'],
          versions: {
            create: {
              version: 1,
              tickets: [ticket],
              configuration: {
                status: 'ACTIVE',
                effectiveFrom: '2026-02-01',
                kind: 'FIXED',
                recipients: ['test@example.invalid'],
                purchased: false,
              },
              createdAt,
            },
          },
        },
      })
    ).id;
    await ingest(past);
    await ingest(past);
    expect(await db.snapshot.count({ where: { groupId: historical } })).toBe(1);
    expect(await db.matchRecord.count({ where: { snapshot: { groupId: historical } } })).toBe(1);
    const mails = await db.mailJob.findMany({ where: { groupId: historical, kind: 'AUTO' } });
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toContain('10.25');
    mailId = mails[0].id;
  });
  it('发送成功只投递一次', async () => {
    process.env.MAIL_DELIVERY_ENABLED = 'true';
    await deliverPending();
    await deliverPending();
    expect(state.sendMail).toHaveBeenCalledTimes(1);
    expect((await db.mailJob.findUniqueOrThrow({ where: { id: mailId } })).status).toBe('SENT');
  });
  it('冲突结果冻结统计并保留证据版本', async () => {
    await ingest({ ...past, numbers: { ...ticket, special: [8] } });
    const draw = await db.draw.findUniqueOrThrow({
      where: { lottery_date: { lottery: 'SSQ', date: new Date(past.date) } },
    });
    expect(draw.status).toBe('CONFLICT');
    expect(await db.drawVersion.count({ where: { drawId: draw.id } })).toBe(2);
  });
  it('手动测试用官方最新结果且不增加匹配统计', async () => {
    state.latest = [
      {
        ...past,
        issue: '9990002',
        date: '2026-03-03',
        numbers: { main: [20, 21, 22, 23, 24, 25], special: [10] },
        prizes: {},
      },
    ];
    const before = await db.matchRecord.count();
    const result = await sendGroupTest(historical);
    expect(result.issue).toBe('9990002');
    expect(result.totalAmount).toBe('0.00');
    expect(await db.matchRecord.count()).toBe(before);
  });
  it('响应不明不自动重试', async () => {
    state.sendMail.mockRejectedValue({ code: 'ETIMEDOUT' });
    process.env.MAIL_DELIVERY_ENABLED = 'true';
    await deliverPending();
    const row = await db.mailJob.findFirstOrThrow({ where: { groupId: historical, kind: 'TEST' } });
    expect(row.status).toBe('UNCERTAIN');
    await deliverPending();
    expect(state.sendMail).toHaveBeenCalledTimes(1);
  });
});
