import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { db } from '@/server/db';
import { BusinessError } from '@/lib/errors';
function encryptionKey() {
  const key = Buffer.from(process.env.APP_ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) throw new BusinessError('邮件加密密钥尚未配置', 'UNAVAILABLE');
  return key;
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  return [
    iv.toString('base64'),
    Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('base64'),
    cipher.getAuthTag().toString('base64'),
  ].join('.');
}
export function decrypt(value: string) {
  const [iv, text, tag] = value.split('.');
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(text, 'base64')), cipher.final()]).toString('utf8');
}
/** 原子时间窗节流，阻止按钮重复提交和跨进程重复操作。 */
export async function throttle(key: string, seconds = 30) {
  const now = new Date();
  const updated = await db.actionThrottle.updateMany({
    where: { key, lastAt: { lt: new Date(now.getTime() - seconds * 1000) } },
    data: { lastAt: now },
  });
  if (updated.count) return;
  try {
    await db.actionThrottle.create({ data: { key, lastAt: now } });
  } catch {
    throw new BusinessError('操作过于频繁，请稍后重试', 'CONFLICT');
  }
}
