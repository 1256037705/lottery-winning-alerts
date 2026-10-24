import type { Lottery, Ticket } from '@/modules/lottery/schema';

/** 编辑态保留两位字符串，避免输入首位 0 时被数字转换吞掉。 */
export type DraftTicket = { main: string[]; special: string[] };
export type BallArea = keyof DraftTicket;
export type BallLocation = { ticket: number; area: BallArea; position: number; error: string };

export function ticketLimits(lottery: Lottery) {
  return lottery === 'SSQ'
    ? { main: { count: 6, max: 33 }, special: { count: 1, max: 16 } }
    : { main: { count: 5, max: 35 }, special: { count: 2, max: 12 } };
}

export function emptyDraft(lottery: Lottery): DraftTicket {
  const limits = ticketLimits(lottery);
  return {
    main: Array(limits.main.count).fill(''),
    special: Array(limits.special.count).fill(''),
  };
}

export function draftFromTicket(ticket: Ticket): DraftTicket {
  return {
    main: ticket.main.map((n) => String(n).padStart(2, '0')),
    special: ticket.special.map((n) => String(n).padStart(2, '0')),
  };
}

/** 与服务端号码范围一致；编辑时即时检查完整号码，提交时还检查空格。 */
export function ballError(values: string[], position: number, max: number, required = false) {
  const value = values[position] ?? '';
  if (!value) return required ? '请输入号码' : null;
  if (!/^\d{2}$/.test(value)) return required ? '请输入两位数字' : null;
  const number = Number(value);
  if (number < 1 || number > max) return `只能输入 01–${max}`;
  if (values.some((other, i) => i !== position && /^\d{2}$/.test(other) && Number(other) === number))
    return '号码重复';
  return null;
}

export function firstDraftError(lines: DraftTicket[], lottery: Lottery): BallLocation | null {
  const limits = ticketLimits(lottery);
  for (let ticket = 0; ticket < lines.length; ticket++) {
    for (const area of ['main', 'special'] as const) {
      if (lines[ticket][area].length !== limits[area].count)
        return { ticket, area, position: 0, error: '号码数量不正确' };
      for (let position = 0; position < limits[area].count; position++) {
        const error = ballError(lines[ticket][area], position, limits[area].max, true);
        if (error) return { ticket, area, position, error };
      }
    }
  }
  return null;
}

export function draftToTicket(line: DraftTicket): Ticket {
  return {
    main: line.main.map(Number),
    special: line.special.map(Number),
  };
}
