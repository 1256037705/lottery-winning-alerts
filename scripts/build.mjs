import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// 构建阶段不连接数据库、不启动任务。临时认证密钥只存在于该构建进程，不写入产物。
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    SCHEDULER_ENABLED: 'false',
    MAIL_DELIVERY_ENABLED: 'false',
    BETTER_AUTH_URL: 'https://build.invalid',
    BETTER_AUTH_SECRET: randomBytes(48).toString('base64'),
  },
});
process.exitCode = result.status ?? 1;
