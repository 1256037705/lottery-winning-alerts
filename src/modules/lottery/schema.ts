import { z } from 'zod';

export const lotterySchema = z.enum(['SSQ', 'DLT']);
export type Lottery = z.infer<typeof lotterySchema>;
export const lotteryNames: Record<Lottery, string> = { SSQ: '双色球', DLT: '超级大乐透' };
/** 日期是业务日，不受客户端或数据库机器所在时区影响。 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, '日期不存在');
export const ticketSchema = z.object({
  main: z.array(z.number().int().positive()),
  special: z.array(z.number().int().positive()),
});
export type Ticket = z.infer<typeof ticketSchema>;
export function validTicket(lottery: Lottery, t: Ticket) {
  const [main, special, maxMain, maxSpecial] = lottery === 'SSQ' ? [6, 1, 33, 16] : [5, 2, 35, 12];
  return (
    t.main.length === main &&
    t.special.length === special &&
    new Set(t.main).size === main &&
    new Set(t.special).size === special &&
    t.main.every((n) => n >= 1 && n <= maxMain) &&
    t.special.every((n) => n >= 1 && n <= maxSpecial)
  );
}
export const groupSchema = z
  .object({
    id: z.string().optional(),
    version: z.number().int().positive().optional(),
    name: z.string().trim().min(1, '请输入名称').max(100),
    lottery: lotterySchema,
    kind: z.enum(['FIXED', 'TEMP']),
    effectiveFrom: dateSchema,
    targetDate: dateSchema.optional(),
    recipients: z.array(z.email()).max(20).default([]),
    purchased: z.boolean().default(false),
    note: z.string().max(500).default(''),
    tickets: z.array(ticketSchema).min(1, '至少输入一注号码').max(100),
  })
  .superRefine((v, ctx) => {
    if (v.tickets.some((t) => !validTicket(v.lottery, t)))
      ctx.addIssue({
        code: 'custom',
        message:
          v.lottery === 'SSQ'
            ? '双色球：6 个不同红球（1–33），1 个蓝球（1–16）'
            : '大乐透：5 个不同前区球（1–35），2 个不同后区球（1–12）',
        path: ['tickets'],
      });
    if (v.kind === 'TEMP' && !v.targetDate)
      ctx.addIssue({ code: 'custom', message: '请选择临时期次日期', path: ['targetDate'] });
    if (v.id && !v.version) ctx.addIssue({ code: 'custom', message: '缺少版本号' });
  });
export type GroupInput = z.infer<typeof groupSchema>;
export const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  lottery: lotterySchema.optional().catch(undefined),
  status: z
    .enum([
      'ACTIVE',
      'PAUSED',
      'ARCHIVED',
      'PLANNED',
      'CONFIRMED',
      'CONFLICT',
      'PENDING',
      'SENT',
      'FAILED',
      'UNCERTAIN',
      'CANCELLED',
      'SENDING',
    ])
    .optional()
    .catch(undefined),
  q: z.string().max(100).optional(),
  from: dateSchema.optional().catch(undefined),
  to: dateSchema.optional().catch(undefined),
});
export type ListQuery = z.infer<typeof querySchema>;
export function dayString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
export const dateValue = (s: string) => new Date(`${dateSchema.parse(s)}T00:00:00Z`);
export const cutoff = (s: string) => new Date(`${dateSchema.parse(s)}T21:30:00+08:00`);
export function drawDay(lottery: Lottery, date: string) {
  return (lottery === 'SSQ' ? [0, 2, 4] : [1, 3, 6]).includes(dateValue(date).getUTCDay());
}
