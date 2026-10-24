'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Table, App, Empty } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { Balls, Heading, LotteryTag, StatusTag } from '@/components/common';
import { Filters, Pager } from '@/components/filters';
import type { getDraws } from '../server/service';
import type { Ticket } from '@/modules/lottery/schema';
import { syncDrawsAction } from '../actions';
type Data = Awaited<ReturnType<typeof getDraws>>;
type Row = Data['rows'][number];
export function Results({ data, canSync }: { data: Data; canSync: boolean }) {
  const [pending, start] = useTransition(),
    router = useRouter(),
    { message } = App.useApp();
  return (
    <>
      <Heading
        eyebrow="DRAW RESULTS"
        title="开奖结果"
        subtitle="官方期号、开奖日期和号码分别展示，结果只读核验。"
        extra={
          canSync && (
            <Button
              icon={<SyncOutlined />}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await syncDrawsAction();
                  if (r.ok) {
                    message.info(r.data.join('；'));
                    router.refresh();
                  } else message.error(r.error);
                })
              }
            >
              同步官方结果
            </Button>
          )
        }
      />
      <Card>
        <Filters statuses={['CONFIRMED', 'CONFLICT']} searchLabel="官方期号" />
        <Table
          rowKey="id"
          pagination={false}
          dataSource={data.rows}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="暂无开奖结果，可同步官方数据" /> }}
          columns={[
            { title: '彩种', dataIndex: 'lottery', width: 150, render: (v) => <LotteryTag lottery={v} /> },
            {
              title: '官方期号',
              dataIndex: 'issue',
              width: 140,
              render: (v) => <strong>{v ? `第 ${v} 期` : '待官方确认'}</strong>,
            },
            { title: '开奖日期', dataIndex: 'date', width: 140 },
            {
              title: '开奖号码',
              key: 'numbers',
              width: 330,
              render: (_: unknown, r: Row) =>
                r.numbers ? <Balls ticket={r.numbers as Ticket} /> : <span className="muted">待公布</span>,
            },
            {
              title: '状态 / 奖金',
              key: 'status',
              render: (_: unknown, r: Row) => (
                <>
                  <StatusTag status={r.status} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {r.prizes && Object.keys(r.prizes).length ? '已获取官方奖级金额' : '奖金待公布'}
                  </div>
                </>
              ),
            },
          ]}
        />
        <Pager total={data.total} />
      </Card>
    </>
  );
}
