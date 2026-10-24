'use client';
import { useRef, useState, useTransition } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Empty,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import type { listGroups } from '../server/repository';
import type { Ticket, Lottery } from '@/modules/lottery/schema';
import { dayString } from '@/modules/lottery/schema';
import { Balls, Heading, LotteryTag, StatusTag, timeLabel } from '@/components/common';
import { Filters, Pager } from '@/components/filters';
import { saveGroupAction, changeGroupAction, sendGroupAction, groupHistoryAction } from '../actions';
import {
  ballError,
  draftFromTicket,
  draftToTicket,
  emptyDraft,
  firstDraftError,
  ticketLimits,
  type BallArea,
  type DraftTicket,
} from '../ticket-input';
type GroupData = Awaited<ReturnType<typeof listGroups>>;
type Row = GroupData['rows'][number];
type FormValues = {
  name: string;
  lottery: Lottery;
  date: dayjs.Dayjs;
  recipients: string;
  purchased: boolean;
  note: string;
};

/** 新增与编辑共用圆形号码格；客户端即时提示，服务端仍独立校验。 */
export function GroupList({
  data,
  kind,
  canWrite,
  canSend,
}: {
  data: GroupData;
  kind: 'FIXED' | 'TEMP';
  canWrite: boolean;
  canSend: boolean;
}) {
  const { message } = App.useApp(),
    router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState<Row | null>(null),
    [open, setOpen] = useState(false),
    [pending, start] = useTransition();
  const [lines, setLines] = useState<DraftTicket[]>([emptyDraft('SSQ')]);
  const [showRequired, setShowRequired] = useState(false);
  const ballRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [history, setHistory] = useState<{ version: number; tickets: unknown; createdAt: string }[] | null>(
    null,
  );
  const lottery = Form.useWatch('lottery', form) ?? 'SSQ';
  const limits = ticketLimits(lottery);
  const ballKey = (ticket: number, area: BallArea, position: number) =>
    `${ticket}-${area}-${position}`;
  function focusBall(ticket: number, area: BallArea, position: number) {
    ballRefs.current[ballKey(ticket, area, position)]?.focus();
  }
  function nextBall(ticket: number, area: BallArea, position: number) {
    if (position + 1 < limits[area].count) focusBall(ticket, area, position + 1);
    else if (area === 'main') focusBall(ticket, 'special', 0);
    else if (ticket + 1 < lines.length) focusBall(ticket + 1, 'main', 0);
  }
  function updateBall(ticket: number, area: BallArea, position: number, raw: string) {
    const value = raw.replace(/\D/g, '').slice(0, 2);
    const values = [...lines[ticket][area]];
    values[position] = value;
    setLines((current) => current.map((line, i) => i === ticket ? { ...line, [area]: values } : line));
    // 无效范围和重复号码保持焦点，方便直接改正。
    if (value.length === 2 && !ballError(values, position, limits[area].max))
      nextBall(ticket, area, position);
  }
  function previousBall(ticket: number, area: BallArea, position: number) {
    if (position > 0) focusBall(ticket, area, position - 1);
    else if (area === 'special') focusBall(ticket, 'main', limits.main.count - 1);
    else if (ticket > 0) focusBall(ticket - 1, 'special', limits.special.count - 1);
  }
  function edit(row: Row | null) {
    setEditing(row);
    form.setFieldsValue({
      name: row?.name ?? '',
      lottery: row?.lottery ?? 'SSQ',
      date: dayjs(row?.targetDate ?? row?.effectiveFrom ?? dayString()),
      recipients: row?.recipients.join(', ') ?? '',
      purchased: row?.purchased ?? false,
      note: row?.note ?? '',
    });
    setLines(row ? (row.tickets as Ticket[]).map(draftFromTicket) : [emptyDraft('SSQ')]);
    setShowRequired(false);
    setOpen(true);
  }
  function save(values: FormValues) {
    const issue = firstDraftError(lines, values.lottery);
    if (issue) {
      setShowRequired(true);
      const zone = issue.area === 'main' ? '红区' : '蓝区';
      message.error(`第 ${issue.ticket + 1} 注${zone}第 ${issue.position + 1} 个号码：${issue.error}`);
      focusBall(issue.ticket, issue.area, issue.position);
      return;
    }
    start(async () => {
      const result = await saveGroupAction({
        id: editing?.id,
        version: editing?.version,
        name: values.name,
        lottery: values.lottery,
        kind,
        effectiveFrom: values.date.format('YYYY-MM-DD'),
        targetDate: kind === 'TEMP' ? values.date.format('YYYY-MM-DD') : undefined,
        recipients: values.recipients.split(/[,，;\s]+/).filter(Boolean),
        purchased: values.purchased ?? false,
        note: values.note ?? '',
        tickets: lines.map(draftToTicket),
      });
      if (!result.ok) {
        message.error(result.error);
        return;
      }
      message.success('号码组已保存');
      setOpen(false);
      router.refresh();
    });
  }
  function change(row: Row, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    start(async () => {
      const r = await changeGroupAction({ id: row.id, version: row.version, status });
      if (r.ok) {
        message.success('状态已更新');
        router.refresh();
      } else message.error(r.error);
    });
  }
  const columns = [
    {
      title: '号码组',
      key: 'name',
      width: 190,
      render: (_: unknown, r: Row) => (
        <>
          <strong>{r.name}</strong>
          <div style={{ marginTop: 8 }}>
            <LotteryTag lottery={r.lottery} />
          </div>
          <small className="muted">
            {r.targetDate ?? r.effectiveFrom}
            {kind === 'FIXED' ? ' 起追踪' : ''}
          </small>
        </>
      ),
    },
    {
      title: '追踪号码',
      key: 'tickets',
      width: 350,
      render: (_: unknown, r: Row) => (
        <>
          {(r.tickets as Ticket[]).map((t, i) => (
            <Balls key={i} ticket={t} />
          ))}
          <small className="muted">
            版本 V{r.version} · {r.purchased ? '已标记购买' : '仅追踪'}
          </small>
        </>
      ),
    },
    { title: '状态', dataIndex: 'status', width: 95, render: (s: string) => <StatusTag status={s} /> },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_: unknown, r: Row) => (
        <Space wrap size={6}>
          {r.status !== 'ARCHIVED' && canWrite && (
            <Button size="small" onClick={() => edit(r)}>
              编辑
            </Button>
          )}
          {kind === 'FIXED' && r.status !== 'ARCHIVED' && canSend && (
            <Popconfirm
              title="发送号码测试邮件？"
              description="将实时获取官方最新一期；无论中奖与否都会发送，且不计入累计中奖。"
              onConfirm={() =>
                start(async () => {
                  const result = await sendGroupAction(r.id);
                  if (result.ok) {
                    message.success(
                      `第 ${result.data.issue} 期测试已加入邮件队列，金额：${result.data.totalAmount ?? '待官方确认'}`,
                    );
                    router.refresh();
                  } else message.error(result.error);
                })
              }
            >
              <Button size="small" loading={pending}>
                发送
              </Button>
            </Popconfirm>
          )}
          {r.status !== 'ARCHIVED' && canWrite && (
            <>
              <Button size="small" onClick={() => change(r, r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}>
                {r.status === 'ACTIVE' ? '暂停' : '启用'}
              </Button>
              <Popconfirm
                title="删除此号码组？"
                description="停止后续追踪，保留历史记录及已发送日志。"
                onConfirm={() => change(r, 'ARCHIVED')}
              >
                <Button size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
          <Button
            size="small"
            onClick={() =>
              start(async () => {
                const result = await groupHistoryAction(r.id);
                if (result.ok) setHistory(result.data);
                else message.error(result.error);
              })
            }
          >
            历史
          </Button>
        </Space>
      ),
    },
  ];
  return (
    <>
      <Heading
        eyebrow={kind === 'FIXED' ? 'NUMBER LIBRARY' : 'ONE-OFF ENTRIES'}
        title={kind === 'FIXED' ? '固定号码' : '临时号码'}
        subtitle={
          kind === 'FIXED'
            ? '维护长期追踪号码，历史期次保留当时的号码版本。'
            : '为指定的预计开奖日期录入一次性号码。'
        }
        extra={
          canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>
              新增号码组
            </Button>
          )
        }
      />
      <Card>
        <Filters statuses={['ACTIVE', 'PAUSED', 'ARCHIVED']} searchLabel="号码组名称" />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.rows}
          pagination={false}
          scroll={{ x: 950 }}
          locale={{ emptyText: <Empty description="暂无号码组，点击右上角新增" /> }}
        />
        <Pager total={data.total} />
      </Card>
      <Modal
        className="number-group-modal"
        title={editing ? '编辑号码组' : '新增号码组'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={pending}
        width={800}
        okText="保存号码组"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={save} style={{ marginTop: 24 }}>
          <div className="two-columns">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item name="lottery" label="彩种" rules={[{ required: true }]}>
              <Select
                disabled={!!editing}
                onChange={(value: Lottery) => {
                  setLines([emptyDraft(value)]);
                  setShowRequired(false);
                }}
                options={[
                  { value: 'SSQ', label: '双色球' },
                  { value: 'DLT', label: '超级大乐透' },
                ]}
              />
            </Form.Item>
          </div>
          <div className="two-columns">
            <Form.Item
              name="date"
              label={kind === 'FIXED' ? '追踪起始日期' : '预计开奖日期'}
              rules={[{ required: true, message: '请选择日期' }]}
            >
              <DatePicker format="YYYY-MM-DD" placeholder="YYYY-MM-DD" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="recipients" label="收件邮箱（逗号分隔）">
              <Input placeholder="留空使用默认收件人" />
            </Form.Item>
          </div>
          <Alert
            type="info"
            showIcon
            title={
              lottery === 'SSQ'
                ? '每注：6 个红球（01–33）＋ 1 个蓝球（01–16）'
                : '每注：5 个前区球（01–35）＋ 2 个后区球（01–12）'
            }
            description="每个圆格输入两位数字，正确后自动跳到下一格；超出范围或重复会立即提示。"
            style={{ marginBottom: 16 }}
          />
          {lines.map((line, index) => (
            <div className="ticket-card" key={index}>
              <div className="ticket-card-header">
                <strong>第 {index + 1} 注</strong>
                <Button
                  type="text"
                  danger
                  aria-label={`删除第${index + 1}注`}
                  icon={<DeleteOutlined />}
                  disabled={lines.length === 1}
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                />
              </div>
              <div className="ticket-zones">
                {(['main', 'special'] as const).map((area) => {
                  const label = area === 'main' ? '红区' : '蓝区';
                  const firstIssue = line[area].map((_, position) =>
                    ballError(line[area], position, limits[area].max, showRequired),
                  ).find(Boolean);
                  return (
                    <div className={`ticket-zone ${area}`} key={area}>
                      <div className="ticket-zone-title">
                        <strong>{area === 'main'
                          ? lottery === 'SSQ' ? '红区号码' : '前区号码'
                          : lottery === 'SSQ' ? '蓝区号码' : '后区号码'}</strong>
                        <span>{String(1).padStart(2, '0')}–{limits[area].max} · {limits[area].count} 个</span>
                      </div>
                      <div className="ticket-balls">
                        {line[area].map((value, position) => {
                          const error = ballError(line[area], position, limits[area].max, showRequired);
                          return (
                            <input
                              key={position}
                              ref={(node) => { ballRefs.current[ballKey(index, area, position)] = node; }}
                              className={`ticket-ball-input ${area}${error ? ' invalid' : ''}`}
                              aria-label={`第${index + 1}注${label}第${position + 1}个号码`}
                              aria-invalid={!!error}
                              aria-describedby={error ? `ticket-error-${index}-${area}` : undefined}
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={2}
                              placeholder="00"
                              value={value}
                              onChange={(event) => updateBall(index, area, position, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Backspace' && !value) previousBall(index, area, position);
                              }}
                            />
                          );
                        })}
                      </div>
                      <div id={`ticket-error-${index}-${area}`} className="ticket-zone-error" role={firstIssue ? 'alert' : undefined}>
                        {firstIssue ? `${label}号码：${firstIssue}` : '\u00a0'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <Button
            block
            type="dashed"
            icon={<PlusOutlined />}
            disabled={lines.length >= 100}
            onClick={() => setLines((current) => [...current, emptyDraft(lottery)])}
          >
            添加一注
          </Button>
          <Form.Item name="purchased" valuePropName="checked" style={{ marginTop: 20 }}>
            <Checkbox>明确确认已购买（默认仅追踪）</Checkbox>
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="号码版本历史（最近 100 个版本）"
        open={history !== null}
        onCancel={() => setHistory(null)}
        footer={<Button onClick={() => setHistory(null)}>关闭</Button>}
        width={700}
      >
        {history?.map((v) => (
          <Card
            key={v.version}
            size="small"
            title={`V${v.version} · ${timeLabel(v.createdAt)}`}
            style={{ marginBottom: 12 }}
          >
            {(v.tickets as Ticket[]).map((t, i) => (
              <Balls key={i} ticket={t} />
            ))}
          </Card>
        ))}
      </Modal>
    </>
  );
}
