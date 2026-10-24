'use client';
import { Card, Descriptions, Table, Tag } from 'antd';
import { Heading, timeLabel } from '@/components/common';
import type { systemStatus } from './service';
export function SystemStatus({ data }: { data: Awaited<ReturnType<typeof systemStatus>> }) {
  const sync = data.lastSync as { at: string; outcomes: string[] } | null;
  return (
    <>
      <Heading eyebrow="SYSTEM" title="系统状态" subtitle="部署状态、最近同步结果与审计轨迹。" />
      <div className="section-stack">
        <Card>
          <Descriptions
            column={{ xs: 1, md: 2 }}
            items={[
              { key: '1', label: '技术架构', children: 'Next.js · PostgreSQL · Prisma' },
              { key: '2', label: '显示时区', children: 'Asia/Shanghai' },
              {
                key: '3',
                label: '定时同步',
                children: (
                  <Tag color={data.scheduler ? 'green' : 'orange'}>
                    {data.scheduler ? '已启用' : '未启用'}
                  </Tag>
                ),
              },
              {
                key: '4',
                label: '邮件投递',
                children: (
                  <Tag color={data.delivery ? 'green' : 'orange'}>{data.delivery ? '已启用' : '未启用'}</Tag>
                ),
              },
              { key: '5', label: '最近同步', children: sync ? timeLabel(sync.at) : '尚未同步' },
              { key: '6', label: '同步结果', children: sync?.outcomes.join('；') ?? '—' },
            ]}
          />
        </Card>
        <Card title="最近 50 条审计记录">
          <Table
            rowKey="id"
            dataSource={data.events}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 700 }}
            columns={[
              { title: '时间', dataIndex: 'createdAt', render: timeLabel },
              { title: '操作者', dataIndex: 'actor' },
              { title: '操作', dataIndex: 'action' },
              { title: '对象 ID', dataIndex: 'entityId', render: (v) => v ?? '—' },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
