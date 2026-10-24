'use client';
import { Tag } from 'antd';
import { lotteryNames, type Lottery, type Ticket } from '@/modules/lottery/schema';
export function Heading({
  title,
  subtitle,
  eyebrow,
  extra,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <div className="muted">{subtitle}</div>
      </div>
      {extra}
    </div>
  );
}
export function LotteryTag({ lottery }: { lottery: Lottery }) {
  return <Tag color={lottery === 'SSQ' ? 'red' : 'blue'}>{lotteryNames[lottery]}</Tag>;
}
export function Balls({ ticket }: { ticket: Ticket }) {
  return (
    <div className="ball-line" aria-label={`红区 ${ticket.main.join(' ')}，蓝区 ${ticket.special.join(' ')}`}>
      {ticket.main.map((n, i) => (
        <span className="ball" key={`m${i}`}>
          {String(n).padStart(2, '0')}
        </span>
      ))}
      <span className="ball-separator" />
      {ticket.special.map((n, i) => (
        <span className="ball blue" key={`s${i}`}>
          {String(n).padStart(2, '0')}
        </span>
      ))}
    </div>
  );
}
export const statusLabels: Record<string, string> = {
  ACTIVE: '启用',
  PAUSED: '暂停',
  ARCHIVED: '已删除',
  PLANNED: '预计开奖',
  CONFIRMED: '已确认',
  CONFLICT: '数据冲突',
  PENDING: '待发送',
  SENDING: '发送中',
  SENT: '已发送',
  FAILED: '发送失败',
  UNCERTAIN: '结果待核实',
  CANCELLED: '已取消',
};
export function StatusTag({ status }: { status: string }) {
  return (
    <Tag
      color={
        ['ACTIVE', 'CONFIRMED', 'SENT'].includes(status)
          ? 'green'
          : ['CONFLICT', 'FAILED', 'UNCERTAIN'].includes(status)
            ? 'red'
            : 'default'
      }
    >
      {statusLabels[status] ?? status}
    </Tag>
  );
}
export function timeLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        dateStyle: 'short',
        timeStyle: 'medium',
        hour12: false,
      }).format(new Date(value))
    : '—';
}
