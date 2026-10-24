import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { testEnv } from '../tests/environment';
const require = createRequire(import.meta.url);
/** 固定测试环境覆盖外部环境变量，防止迁移连接到生产。 */
for (const [entry, args] of [
  [require.resolve('prisma/build/index.js'), ['migrate', 'deploy']],
  [require.resolve('tsx/cli'), ['scripts/seed.ts']],
] as const) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...testEnv },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
