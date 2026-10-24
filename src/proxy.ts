import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/server/auth';
/** 提前完成页面登录跳转，避免并行 Layout/Page 抛错抢占重定向。
 * 此处只改善入口行为；每个业务 Service 仍独立执行权限与数据范围校验。
 */
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}
export const config = {
  matcher: [
    '/',
    '/fixed/:path*',
    '/temporary/:path*',
    '/results/:path*',
    '/calendar/:path*',
    '/rules/:path*',
    '/mail-tasks/:path*',
    '/logs/:path*',
    '/settings/:path*',
  ],
};
