import 'server-only';
import { z } from 'zod';
import { lotterySchema, ticketSchema, dateSchema, validTicket, type Lottery } from './schema';
import { cents, money } from './matching';
import { BusinessError } from '@/lib/errors';

const tiers = ['一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖'];
export const officialDrawSchema = z
  .object({
    lottery: lotterySchema,
    issue: z.string().regex(/^\d{5,10}$/),
    date: dateSchema,
    numbers: ticketSchema,
    prizes: z.record(z.string(), z.string()),
    source: z.url(),
  })
  .refine((d) => validTicket(d.lottery, d.numbers), '官方号码格式异常');
export type OfficialDraw = z.infer<typeof officialDrawSchema>;
const scalar = z.union([z.string(), z.number()]).transform(String);
const ssqSchema = z.object({
  result: z
    .array(
      z.object({
        code: scalar,
        date: z.string(),
        red: z.string(),
        blue: scalar,
        prizegrades: z.array(z.object({ type: scalar, typemoney: scalar })).default([]),
      }),
    )
    .max(100),
});
const dltSchema = z.object({
  value: z.object({
    list: z
      .array(
        z.object({
          lotteryDrawNum: scalar,
          lotteryDrawTime: z.string(),
          lotteryDrawResult: z.string(),
          prizeLevelList: z
            .array(
              z.object({
                prizeLevel: z.string(),
                stakeAmountFormat: scalar.optional(),
                stakeAmount: scalar.optional(),
              }),
            )
            .default([]),
        }),
      )
      .max(100),
  }),
});
const numbers = (s: string) => s.trim().split(/[ ,]+/).map(Number);
function amount(raw: string) {
  const clean = raw.replaceAll(',', '');
  return /^\d{1,14}(\.\d{1,2})?$/.test(clean) ? money(cents(clean)) : undefined;
}
/** 外部 JSON 在此收口，拒绝不完整日期、号码以及超量响应。 */
export function parseOfficial(lottery: Lottery, input: unknown): OfficialDraw[] {
  const rows =
    lottery === 'SSQ'
      ? ssqSchema.parse(input).result.map((d) => {
          const prizes: Record<string, string> = {};
          for (const p of d.prizegrades) {
            const name = Number(p.type) === 7 ? '福运奖' : tiers[Number(p.type) - 1];
            const value = amount(p.typemoney);
            if (name && value !== undefined) prizes[name] = value;
          }
          return {
            lottery,
            issue: d.code,
            date: d.date.slice(0, 10),
            numbers: { main: numbers(d.red), special: numbers(d.blue) },
            prizes,
            source: 'https://www.cwl.gov.cn/',
          };
        })
      : dltSchema.parse(input).value.list.map((d) => {
          const prizes: Record<string, string> = {};
          for (const p of d.prizeLevelList) {
            const value = amount(p.stakeAmountFormat ?? p.stakeAmount ?? '');
            if (tiers.includes(p.prizeLevel) && value !== undefined) prizes[p.prizeLevel] = value;
          }
          const all = numbers(d.lotteryDrawResult);
          return {
            lottery,
            issue: d.lotteryDrawNum,
            date: d.lotteryDrawTime.slice(0, 10),
            numbers: { main: all.slice(0, 5), special: all.slice(5) },
            prizes,
            source: 'https://www.lottery.gov.cn/',
          };
        });
  return rows.map((d) => officialDrawSchema.parse(d)).sort((a, b) => b.date.localeCompare(a.date));
}
/** URL 固定且不跟随重定向，避免从用户输入制造 SSRF。 */
export async function fetchOfficial(lottery: Lottery) {
  const url =
    lottery === 'SSQ'
      ? 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=30'
      : 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=30&isVerify=1&pageNo=1';
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: lottery === 'SSQ' ? 'https://www.cwl.gov.cn/' : 'https://m.lottery.gov.cn/',
      },
    });
    if (!response.ok || !response.body) throw new Error('HTTP');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new Error('SIZE');
      }
      chunks.push(value);
    }
    return parseOfficial(lottery, JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    throw new BusinessError(
      `${lottery === 'SSQ' ? '福彩' : '体彩'}官方数据暂不可用，请稍后重试；未用旧期冒充最新一期`,
      'UNAVAILABLE',
    );
  }
}
