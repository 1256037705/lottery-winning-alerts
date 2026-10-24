import type { Lottery, Ticket } from './schema';

export type Prizes = Record<string, string>;
export type MatchDetail = {
  ticket: Ticket;
  mainHits: number;
  specialHits: number;
  tier: string | null;
  amount: string | null;
};
/** 整数分运算：数据库 Decimal 与 JSON 字符串之间不经过浮点数。 */
export function cents(amount: string): bigint {
  if (!/^\d{1,14}(\.\d{1,2})?$/.test(amount)) throw new Error('无效的奖金金额');
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function money(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
/** 仅支持当前版本规则；历史规则不明时返回待核实，绝不猜测奖金。 */
export function evaluate(lottery: Lottery, tickets: Ticket[], draw: Ticket, prizes: Prizes, date: string) {
  const supported = date >= (lottery === 'SSQ' ? '2026-02-01' : '2026-02-02');
  const details: MatchDetail[] = tickets.map((ticket) => {
    const a = ticket.main.filter((n) => draw.main.includes(n)).length;
    const b = ticket.special.filter((n) => draw.special.includes(n)).length;
    let tier: string | null = null;
    if (lottery === 'SSQ') {
      tier =
        a === 6
          ? b === 1
            ? '一等奖'
            : '二等奖'
          : a === 5 && b === 1
            ? '三等奖'
            : a === 5 || (a === 4 && b === 1)
              ? '四等奖'
              : a === 4 || (a === 3 && b === 1)
                ? '五等奖'
                : b === 1
                  ? '六等奖'
                  : a === 3
                    ? '福运奖'
                    : null;
      // 福运奖是否启动只接受本期官方奖级表；缺失时不能断言中奖或未中奖。
    } else {
      tier =
        a === 5 && b === 2
          ? '一等奖'
          : a === 5 && b === 1
            ? '二等奖'
            : a === 5 || (a === 4 && b === 2)
              ? '三等奖'
              : a === 4 && b === 1
                ? '四等奖'
                : a === 4 || (a === 3 && b === 2)
                  ? '五等奖'
                  : (a === 3 && b === 1) || (a === 2 && b === 2)
                    ? '六等奖'
                    : a === 3 || (a === 2 && b === 1) || b === 2
                      ? '七等奖'
                      : null;
    }
    const amount = !supported
      ? null
      : tier
        ? prizes[tier] === undefined
          ? null
          : money(cents(prizes[tier]))
        : '0.00';
    return { ticket, mainHits: a, specialHits: b, tier, amount };
  });
  const totalAmount = details.some((d) => d.amount === null)
    ? null
    : money(details.reduce((sum, d) => sum + cents(d.amount!), 0n));
  return {
    details,
    totalAmount,
    winning: details.some((d) => d.amount !== null && cents(d.amount) > 0n)
      ? true
      : totalAmount === null
        ? null
        : false,
  };
}
