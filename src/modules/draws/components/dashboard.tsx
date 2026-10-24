'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Alert, Button, Card, Spin, Table, Space, Tag } from 'antd';
import { Heading, LotteryTag } from '@/components/common';
import type { dashboard } from '../server/service';
const Trend = dynamic(() => import('./trend'), {
  ssr: false,
  loading: () => <Spin style={{ padding: 60 }} />,
});
export function Dashboard({ data }: { data: Awaited<ReturnType<typeof dashboard>> }) {
  return (
    <>
      <Heading
        eyebrow="OVERVIEW"
        title="开奖工作台"
        subtitle="号码、开奖与通知，一目了然。"
        extra={
          <Link href="/fixed">
            <Button type="primary">管理追踪号码</Button>
          </Link>
        }
      />
      <div className="bento">
        {[
          { label: '累计理论中奖', value: data.total, unit: '元', hint: '全部有效追踪记录 · 税前' },
          { label: '已标记购买的奖金', value: data.purchasedTotal, unit: '元', hint: '非实际到账，不扣税费' },
          { label: '启用号码组', value: data.groups, unit: '组', hint: '固定号码与临时号码' },
          { label: '已确认开奖', value: data.draws, unit: '期', hint: '来自官方数据源' },
        ].map((m) => (
          <Card key={m.label}>
            <div className="muted">{m.label}</div>
            <div className="metric-value">
              {m.value}
              <span className="metric-unit">{m.unit}</span>
            </div>
            <small className="muted">{m.hint}</small>
          </Card>
        ))}
      </div>
      {data.unknown > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`有 ${data.unknown} 条记录的奖金待官方确认，不计入金额合计`}
          style={{ marginBottom: 24 }}
        />
      )}
      <div className="two-columns" style={{ marginBottom: 24 }}>
        <Card title="中奖趋势" extra={<span className="muted">最近 100 条匹配记录</span>}>
          <Trend data={data.recent} />
        </Card>
        <Card title="追踪与通知规则">
          <div className="section-stack">
            <div>
              <Tag color="blue">自动通知</Tag>
              <p>只有确认中奖且本期奖金明确时才发送。未中奖不会发送自动邮件。</p>
            </div>
            <div>
              <Tag>手动测试</Tag>
              <p>点击固定号码的“发送”，实时对比官方最新一期，无论中奖与否都会发邮件；测试不计入统计。</p>
            </div>
            <Space wrap>
              <Link href="/calendar">
                <Button>查看开奖日历</Button>
              </Link>
              <Link href="/mail-tasks">
                <Button>查看邮件任务</Button>
              </Link>
              <Link href="/rules">
                <Button>查看规则</Button>
              </Link>
            </Space>
          </div>
        </Card>
      </div>
      <Card title="最近匹配明细">
        <Table
          rowKey="id"
          dataSource={data.recent}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 720 }}
          columns={[
            { title: '号码组', dataIndex: 'name' },
            { title: '彩种', dataIndex: 'lottery', render: (v) => <LotteryTag lottery={v} /> },
            { title: '开奖日期', dataIndex: 'date' },
            { title: '官方期号', dataIndex: 'issue' },
            { title: '奖金（元）', dataIndex: 'amount', render: (v) => <strong>{v ?? '待确认'}</strong> },
            {
              title: '记录类型',
              dataIndex: 'purchased',
              render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '已标记购买' : '仅追踪'}</Tag>,
            },
          ]}
        />
      </Card>
    </>
  );
}
