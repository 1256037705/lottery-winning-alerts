/** 仅限本地一次性测试；这些固定凭据绝不能用于生产。 */
export const testEnv = {
  DATABASE_URL: 'postgresql://lottery_test:test-only@127.0.0.1:55433/lottery_test',
  BETTER_AUTH_URL: 'http://127.0.0.1:3100',
  BETTER_AUTH_SECRET: 'local-test-only-secret-not-for-production-20261022',
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  SCHEDULER_ENABLED: 'false',
  MAIL_DELIVERY_ENABLED: 'false',
  BOOTSTRAP_USERNAME: 'testadmin',
  BOOTSTRAP_EMAIL: 'testadmin@example.invalid',
  BOOTSTRAP_PASSWORD: 'Local-Test-Password-2026',
};
