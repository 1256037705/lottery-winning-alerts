import { defineConfig } from 'vitest/config';
import base from './vitest.config';
import { testEnv } from './tests/environment';
export default defineConfig({
  ...base,
  test: {
    include: ['tests/integration/**/*.test.ts'],
    env: testEnv,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
