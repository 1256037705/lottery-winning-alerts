'use client';
import { Alert, Card, Table } from 'antd';
import { Heading, StatusTag, timeLabel } from '@/components/common';
import { Filters, Pager } from '@/components/filters';
import type { getMail } from '../server/service';
export function MailList({ data, logs }: { data: Awaited<ReturnType<typeof getMail>>; logs: boolean }) {
  return (
    <>
      <Heading
        eyebrow="NOTIFICATION CENTER"
        title={logs ? '发送日志' : '邮件任务'}
        subtitle="自动中奖通知与手动测试分开记录，保留发送结果。"
      />
      <Alert
        type="info"
        showIcon
        title="结果待核实表示 SMTP 发送结果不确定：请先检查收件箱，系统不会盲目重复发送。"
        style={{ marginBottom: 20 }}
      />
      <Card>
        <Filters
          lottery={false}
          statuses={['PENDING', 'SENDING', 'SENT', 'FAILED', 'UNCERTAIN', 'CANCELLED']}
          searchLabel="邮件主题"
        />
        <Table
          rowKey="id"
          pagination={false}
          dataSource={data.rows}
          scroll={{ x: 1000 }}
          columns={[
            { title: '主题', dataIndex: 'subject', width: 280 },
            {
              title: '类型',
              dataIndex: 'kind',
              render: (v) =>
                ({ AUTO: '自动中奖通知', TEST: '号码手动测试', SMTP_TEST: 'SMTP 测试' })[v as 'AUTO'] ?? v,
            },
            { title: '状态', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
            { title: '创建时间', dataIndex: 'createdAt', render: timeLabel },
            { title: '发送时间', dataIndex: 'sentAt', render: timeLabel },
            { title: '说明', dataIndex: 'error', width: 260, render: (v) => v ?? '—' },
          ]}
        />
        <Pager total={data.total} />
      </Card>
    </>
  );
}
