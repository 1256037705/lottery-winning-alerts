'use client';
import { Button, DatePicker, Input, Select, Pagination } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import dayjs from 'dayjs';
import { statusLabels } from './common';
export function Filters({
  statuses = [],
  lottery = true,
  searchLabel = '名称 / 期号',
}: {
  statuses?: string[];
  lottery?: boolean;
  searchLabel?: string;
}) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const [pending, start] = useTransition();
  const [value, setValue] = useState<Record<string, string>>(Object.fromEntries(params.entries()));
  const update = (key: string, v: string) => setValue((s) => ({ ...s, [key]: v }));
  function submit(clear = false) {
    const p = new URLSearchParams(clear ? {} : value);
    p.delete('page');
    for (const [k, v] of p) if (!v) p.delete(k);
    start(() => router.push(`${path}?${p}`));
    if (clear) setValue({});
  }
  return (
    <form
      className="filter-bar"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {lottery && (
        <label className="filter-field">
          彩种
          <Select
            aria-label="筛选彩种"
            style={{ width: 140 }}
            value={value.lottery ?? ''}
            onChange={(v) => update('lottery', v)}
            options={[
              { value: '', label: '全部彩种' },
              { value: 'SSQ', label: '双色球' },
              { value: 'DLT', label: '超级大乐透' },
            ]}
          />
        </label>
      )}
      {!!statuses.length && (
        <label className="filter-field">
          状态
          <Select
            aria-label="筛选状态"
            style={{ width: 140 }}
            value={value.status ?? ''}
            onChange={(v) => update('status', v)}
            options={[
              { value: '', label: '默认状态' },
              ...statuses.map((s) => ({ value: s, label: statusLabels[s] })),
            ]}
          />
        </label>
      )}
      <label className="filter-field">
        起始日期
        <DatePicker
          aria-label="起始日期"
          format="YYYY-MM-DD"
          placeholder="YYYY-MM-DD"
          value={value.from && dayjs(value.from).isValid() ? dayjs(value.from) : null}
          onChange={(d) => update('from', d?.format('YYYY-MM-DD') ?? '')}
        />
      </label>
      <label className="filter-field">
        结束日期
        <DatePicker
          aria-label="结束日期"
          format="YYYY-MM-DD"
          placeholder="YYYY-MM-DD"
          value={value.to && dayjs(value.to).isValid() ? dayjs(value.to) : null}
          onChange={(d) => update('to', d?.format('YYYY-MM-DD') ?? '')}
        />
      </label>
      <label className="filter-field">
        {searchLabel}
        <Input
          value={value.q ?? ''}
          onChange={(e) => update('q', e.target.value)}
          allowClear
          style={{ width: 180 }}
        />
      </label>
      <Button type="primary" htmlType="submit" loading={pending}>
        筛选
      </Button>
      <Button onClick={() => submit(true)}>重置</Button>
    </form>
  );
}
export function Pager({ total }: { total: number }) {
  const params = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  return (
    <div className="table-footer">
      <span className="muted">共 {total} 条 · 每页 20 条</span>
      <Pagination
        current={Number(params.get('page')) || 1}
        total={total}
        pageSize={20}
        showSizeChanger={false}
        onChange={(n) => {
          const p = new URLSearchParams(params);
          p.set('page', String(n));
          router.push(`${path}?${p}`);
        }}
      />
    </div>
  );
}
