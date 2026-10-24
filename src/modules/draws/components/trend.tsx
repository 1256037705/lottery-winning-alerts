'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Empty, Spin } from 'antd';
/** 图表按需加载；金额精确统计在服务端，图表 Number 仅用于像素坐标。 */
export default function Trend({ data }: { data: { date: string; amount: string | null }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    async function setup() {
      try {
        const echarts = await import('echarts/core');
        const [{ LineChart }, { GridComponent, TooltipComponent }, { CanvasRenderer }] = await Promise.all([
          import('echarts/charts'),
          import('echarts/components'),
          import('echarts/renderers'),
        ]);
        if (disposed || !ref.current) return;
        echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);
        const chart = echarts.init(ref.current);
        const totals = new Map<string, number>();
        for (const r of data)
          if (r.amount !== null) totals.set(r.date, (totals.get(r.date) ?? 0) + Number(r.amount));
        const sorted = [...totals].sort(([a], [b]) => a.localeCompare(b));
        chart.setOption({
          color: ['#1677ff'],
          tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${Number(v).toFixed(2)} 元` },
          grid: { left: 64, right: 20, bottom: 30, top: 20 },
          xAxis: {
            type: 'category',
            data: sorted.map(([d]) => d),
            axisLine: { lineStyle: { color: '#e5eaf1' } },
            axisLabel: { color: '#7b889a' },
          },
          yAxis: { type: 'value', name: '元', splitLine: { lineStyle: { color: '#edf1f7' } } },
          series: [
            {
              type: 'line',
              data: sorted.map(([, v]) => v),
              smooth: true,
              symbolSize: 7,
              areaStyle: { color: '#e6f4ff' },
            },
          ],
        });
        const resize = new ResizeObserver(() => chart.resize());
        resize.observe(ref.current);
        cleanup = () => {
          resize.disconnect();
          chart.dispose();
        };
        setStatus('ready');
      } catch {
        if (!disposed) setStatus('error');
      }
    }
    if (data.length) void setup();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [data]);
  if (!data.length) return <Empty description="尚无匹配记录，开奖后将在此显示趋势" style={{ padding: 64 }} />;
  return (
    <>
      {status === 'error' && <Alert title="图表加载失败，金额仍可在明细列表查看" type="warning" />}
      <Spin spinning={status === 'loading'}>
        <div
          ref={ref}
          className="chart-box"
          role="img"
          aria-label="最近 100 条匹配记录按开奖日汇总的税前中奖金额"
        />
      </Spin>
    </>
  );
}
