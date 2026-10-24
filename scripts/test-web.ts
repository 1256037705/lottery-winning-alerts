import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { testEnv } from '../tests/environment';
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
  { stdio: 'inherit', env: { ...process.env, ...testEnv } },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
