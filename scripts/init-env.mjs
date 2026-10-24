import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
/** 首次部署生成密钥；wx 禁止覆盖现有密钥，防止 SMTP 数据无法解密。 */
if (!process.argv[2]) throw new Error('请传入站点地址，例如 https://YOUR_LAN_IP:8443');
const origin = new URL(process.argv[2]);
if (origin.protocol !== 'https:' || origin.port !== '8443' || origin.pathname !== '/')
  throw new Error('请输入 HTTPS 8443 站点地址');
const password = randomBytes(32).toString('hex');
const lines = [
  `LAN_BIND_IP=${origin.hostname}`,
  `SITE_ADDRESS=${origin.origin}`,
  `DATABASE_URL=postgresql://lottery:${password}@db:5432/lottery`,
  `POSTGRES_PASSWORD=${password}`,
  `BETTER_AUTH_URL=${origin.origin}`,
  `BETTER_AUTH_SECRET=${randomBytes(48).toString('base64')}`,
  `APP_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  'SCHEDULER_ENABLED=true',
  'MAIL_DELIVERY_ENABLED=false',
  'BOOTSTRAP_USERNAME=admin',
  'BOOTSTRAP_EMAIL=admin@example.invalid',
];
writeFileSync('.env', lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log('已创建 .env（不输出密钥）；邮件投递默认关闭。');
