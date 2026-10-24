'use client';
import { Button, Card, DatePicker, Select, Space, Tag } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import type { getDraws } from '../server/service';
import { Balls, Heading, LotteryTag } from '@/components/common';
import { dayString, drawDay, type Lottery, type Ticket } from '@/modules/lottery/schema';
export function DrawCalendar({
  rows,
  month,
}: {
  rows: Awaited<ReturnType<typeof getDraws>>['rows'];
  month: string;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    selected = params.get('lottery') ?? '';
  const first = dayjs(`${month}-01`),
    start = first.subtract((first.day() + 6) % 7, 'day');
  function navigate(m: string, lottery = selected) {
    const p = new URLSearchParams({ month: m });
    if (lottery) p.set('lottery', lottery);
    router.push(`/calendar?${p}`);
  }
  return (
    <>
      <Heading
        eyebrow="DRAW CALENDAR"
        title="开奖日历"
        subtitle="红色标记双色球，蓝色标记大乐透；历史号码直接显示在日期下。"
      />
      <Card>
        <div className="page-heading">
          <Space>
            <Button
              aria-label="上个月"
              icon={<LeftOutlined />}
              onClick={() => navigate(first.subtract(1, 'month').format('YYYY-MM'))}
            />
            <DatePicker
              picker="month"
              format="YYYY-MM"
              allowClear={false}
              value={first}
              onChange={(d) => d && navigate(d.format('YYYY-MM'))}
            />
            <Button
              aria-label="下个月"
              icon={<RightOutlined />}
              onClick={() => navigate(first.add(1, 'month').format('YYYY-MM'))}
            />
            <Button onClick={() => navigate(dayString().slice(0, 7))}>本月</Button>
          </Space>
          <Select
            aria-label="日历彩种"
            value={selected}
            style={{ width: 150 }}
            options={[
              { value: '', label: '全部彩种' },
              { value: 'SSQ', label: '双色球' },
              { value: 'DLT', label: '超级大乐透' },
            ]}
            onChange={(v) => navigate(month, v)}
          />
        </div>
        <Space style={{ marginBottom: 20 }}>
          <LotteryTag lottery="SSQ" />
          <LotteryTag lottery="DLT" />
          <span className="muted">预计开奖日不是官方期次</span>
        </Space>
        <div className="calendar-scroll">
          <div className="draw-calendar">
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
              <div className="calendar-weekday" key={w}>
                星期{w}
              </div>
            ))}
            {Array.from({ length: 42 }, (_, index) => {
              const day = start.add(index, 'day'),
                date = day.format('YYYY-MM-DD'),
                draws = rows.filter((r) => r.date === date && (!selected || r.lottery === selected));
              return (
                <div className={`calendar-cell ${day.month() !== first.month() ? 'outside' : ''}`} key={date}>
                  <div className={`calendar-day ${date === dayString() ? 'today' : ''}`}>{day.date()}</div>
                  {(['SSQ', 'DLT'] as Lottery[])
                    .filter((l) => !selected || l === selected)
                    .map((l) => {
                      const draw = draws.find((d) => d.lottery === l);
                      if (!draw && (!drawDay(l, date) || date < dayString())) return null;
                      return (
                        <div className="calendar-draw" key={l}>
                          <LotteryTag lottery={l} />
                          {draw?.issue && <div style={{ marginTop: 6 }}>第 {draw.issue} 期</div>}
                          {draw?.numbers ? (
                            <Balls ticket={draw.numbers as Ticket} />
                          ) : (
                            <div className="muted" style={{ marginTop: 6 }}>
                              预计开奖 · 期号待确认
                            </div>
                          )}
                          {draw?.status === 'CONFLICT' && <Tag color="red">结果待核实</Tag>}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </>
  );
}
