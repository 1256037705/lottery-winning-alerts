import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { BusinessError, type ActionResult } from '@/lib/errors';
/** 输出安全错误，禁止把数据库堆栈或服务端凭据发回浏览器。 */
export async function perform<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    revalidatePath('/', 'layout');
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { ok: false, error: error.issues[0]?.message ?? '输入不合法', code: 'VALIDATION' };
    if (error instanceof BusinessError) return { ok: false, error: error.message, code: error.code };
    console.error('Action failed', error instanceof Error ? error.name : 'UnknownError');
    return { ok: false, error: '操作未完成，请稍后重试', code: 'UNAVAILABLE' };
  }
}
