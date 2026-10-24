import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { username } from 'better-auth/plugins';
import { db } from '@/server/db';

/** 数据库 Session 为唯一认证来源；关闭公开注册，管理员用初始化命令创建。 */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
  plugins: [username()],
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 30 },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 60,
    customRules: { '/sign-in/username': { window: 60, max: 5 }, '/sign-in/email': { window: 60, max: 5 } },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },
});
