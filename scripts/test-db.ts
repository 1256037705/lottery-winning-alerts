import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
/** 真 PostgreSQL 隔离库，固定只监听回环地址，不连接生产。 */
async function main() {
  const databaseDir = resolve('test-artifacts/postgres');
  mkdirSync(resolve('test-artifacts'), { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'lottery_test',
    password: 'test-only',
    port: 55433,
    persistent: true,
    authMethod: 'scram-sha-256',
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='lottery_test'")).rowCount)
    await pg.createDatabase('lottery_test');
  await client.end();
  console.log('隔离 PostgreSQL 已就绪：127.0.0.1:55433 / lottery_test');
  const timer = setInterval(() => {}, 60000);
  async function stop() {
    clearInterval(timer);
    await pg.stop();
    process.exit(0);
  }
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : '测试数据库启动失败');
  process.exitCode = 1;
});
