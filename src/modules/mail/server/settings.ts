import 'server-only';
import { db } from '@/server/db';
import { requireActor } from '@/server/permissions';
import { audit } from '@/server/audit';
import { encrypt } from '@/server/security';
import { smtpSchema, type StoredSmtp } from '../schema';
import { BusinessError } from '@/lib/errors';
/** 仅供服务端内部使用；密文不会进入页面 DTO。 */
export async function smtpConfig(): Promise<StoredSmtp | null> {
  const record = await db.setting.findUnique({ where: { key: 'smtp' } });
  return record ? (record.value as unknown as StoredSmtp) : null;
}
export async function readSmtp() {
  await requireActor('settings.write');
  const config = await smtpConfig();
  if (!config) return null;
  const { encryptedPassword, ...publicFields } = config;
  return { ...publicFields, hasPassword: !!encryptedPassword };
}
export async function saveSmtp(input: unknown) {
  const actor = await requireActor('settings.write');
  const { password, ...data } = smtpSchema.parse(input);
  const old = await smtpConfig();
  const encryptedPassword = password ? encrypt(password) : old?.encryptedPassword;
  if (!encryptedPassword) throw new BusinessError('首次配置需要填写邮箱授权码');
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: 'smtp' },
      create: { key: 'smtp', value: { ...data, encryptedPassword } },
      update: { value: { ...data, encryptedPassword } },
    });
    await audit(
      actor.id,
      'smtp.update',
      null,
      { autoEnabled: data.autoEnabled, passwordChanged: !!password },
      tx,
    );
  });
}
