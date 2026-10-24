import { describe, it, expect } from 'vitest';
import { dateSchema, groupSchema, validTicket, cutoff, dayString } from '@/modules/lottery/schema';
import { evaluate, cents, money } from '@/modules/lottery/matching';
import { parseOfficial } from '@/modules/lottery/provider';
const ssq = { main: [1, 2, 3, 4, 5, 6], special: [7] };
const dlt = { main: [1, 2, 3, 4, 5], special: [1, 2] };
const prizes = {
  一等奖: '5000000',
  二等奖: '100000',
  三等奖: '6666',
  四等奖: '380',
  五等奖: '200',
  六等奖: '18',
  七等奖: '7',
  福运奖: '5',
};
describe('日期与输入', () => {
  it('拒绝不存在的日期及浏览器混乱格式', () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(dateSchema.safeParse('2026/10/22').success).toBe(false);
    expect(dateSchema.parse('2028-02-29')).toBe('2028-02-29');
  });
  it('上海时区与 UTC 规范化', () => {
    expect(cutoff('2026-10-22').toISOString()).toBe('2026-10-22T13:30:00.000Z');
    expect(dayString(new Date('2026-10-21T18:00:00Z'))).toBe('2026-10-22');
  });
  it('验证彩种数量、范围及重复号码', () => {
    expect(validTicket('SSQ', ssq)).toBe(true);
    expect(validTicket('DLT', ssq)).toBe(false);
    expect(validTicket('SSQ', { ...ssq, main: [1, 1, 2, 3, 4, 5] })).toBe(false);
    expect(validTicket('SSQ', { ...ssq, special: [17] })).toBe(false);
  });
  it('临时号码要求日期，编辑要求版本', () => {
    const base = { name: '测试', lottery: 'SSQ', kind: 'TEMP', effectiveFrom: '2026-10-22', tickets: [ssq] };
    expect(groupSchema.safeParse(base).success).toBe(false);
    expect(groupSchema.safeParse({ ...base, targetDate: '2026-10-22' }).success).toBe(true);
    expect(groupSchema.safeParse({ ...base, kind: 'FIXED', id: 'x' }).success).toBe(false);
  });
});
describe('金额和匹配', () => {
  it('整数分相加不损失精度', () => {
    expect(money(cents('0.10') + cents('0.20'))).toBe('0.30');
    expect(() => cents('NaN')).toThrow();
    expect(() => cents('-1')).toThrow();
  });
  it('一等奖与单注只记最高奖', () => {
    const r = evaluate('SSQ', [ssq], ssq, prizes, '2026-10-22');
    expect(r.totalAmount).toBe('5000000.00');
    expect(r.details[0].tier).toBe('一等奖');
  });
  it('未中奖返回明确 0 元', () => {
    const r = evaluate('SSQ', [{ main: [11, 12, 13, 14, 15, 16], special: [10] }], ssq, {}, '2026-10-22');
    expect(r.winning).toBe(false);
    expect(r.totalAmount).toBe('0.00');
  });
  it('奖金缺失不按 0 元处理', () => {
    expect(evaluate('SSQ', [ssq], ssq, {}, '2026-10-22').totalAmount).toBeNull();
  });
  it('福运奖未确认不能断言未中奖', () => {
    const t = { main: [1, 2, 3, 20, 21, 22], special: [10] };
    expect(evaluate('SSQ', [t], ssq, {}, '2026-10-22').winning).toBeNull();
    expect(evaluate('SSQ', [t], ssq, prizes, '2026-10-22').totalAmount).toBe('5.00');
  });
  it('旧规则日期不使用当前规则猜奖', () => {
    expect(evaluate('DLT', [dlt], dlt, prizes, '2026-02-01').totalAmount).toBeNull();
  });
  it.each([
    [5, 2, '一等奖'],
    [5, 1, '二等奖'],
    [5, 0, '三等奖'],
    [4, 2, '三等奖'],
    [4, 1, '四等奖'],
    [4, 0, '五等奖'],
    [3, 2, '五等奖'],
    [3, 1, '六等奖'],
    [2, 2, '六等奖'],
    [3, 0, '七等奖'],
    [2, 1, '七等奖'],
    [1, 2, '七等奖'],
    [0, 2, '七等奖'],
    [1, 1, null],
  ] as const)('大乐透 %i+%i -> %s', (a, b, tier) => {
    const t = {
      main: [...dlt.main.slice(0, a), ...Array.from({ length: 5 - a }, (_, i) => 10 + i)],
      special: [...dlt.special.slice(0, b), ...Array.from({ length: 2 - b }, (_, i) => 10 + i)],
    };
    expect(evaluate('DLT', [t], dlt, prizes, '2026-10-22').details[0].tier).toBe(tier);
  });
});
describe('官方数据解析', () => {
  it('按日期排序而非数组顺序，并正确解析金额', () => {
    const row = { red: '01,02,03,04,05,06', blue: '07', prizegrades: [{ type: 1, typemoney: '5,000,000' }] };
    const result = parseOfficial('SSQ', {
      result: [
        { ...row, code: '2026111', date: '2026-10-10(六)' },
        { ...row, code: '2026112', date: '2026-10-12' },
      ],
    });
    expect(result[0].issue).toBe('2026112');
    expect(result[0].prizes['一等奖']).toBe('5000000.00');
  });
  it('拒绝异常官方号码', () => {
    expect(() =>
      parseOfficial('SSQ', { result: [{ code: '2026111', date: '2026-10-10', red: '01,02', blue: '07' }] }),
    ).toThrow();
  });
  it('大乐透只采用基本奖级，不把追加金额覆盖基本金额', () => {
    const result = parseOfficial('DLT', {
      value: {
        list: [
          {
            lotteryDrawNum: '26111',
            lotteryDrawTime: '2026-10-10 21:30:00',
            lotteryDrawResult: '01 02 03 04 05 01 02',
            prizeLevelList: [
              { prizeLevel: '一等奖', stakeAmountFormat: '5,000,000' },
              { prizeLevel: '追加一等奖', stakeAmountFormat: '4,000,000' },
            ],
          },
        ],
      },
    });
    expect(result[0].prizes['一等奖']).toBe('5000000.00');
  });
});
