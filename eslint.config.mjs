import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // 测试数据库、截图和备份是运行产物，不属于源码检查范围。
  globalIgnores(['.next/**', 'src/generated/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**', 'test-artifacts/**', 'backups/**']),
]);
