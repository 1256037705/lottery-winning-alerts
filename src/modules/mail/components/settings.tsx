'use client';
import { useTransition } from 'react';
import { Alert, App, Button, Card, Form, Input, Popconfirm, Select, Space, Switch } from 'antd';
import { Heading } from '@/components/common';
import { saveSmtpAction, testSmtpAction } from '../actions';
import type { readSmtp } from '../server/settings';
import type { SmtpInput } from '../schema';
export function MailSettings({
  config,
  deliveryEnabled,
}: {
  config: Awaited<ReturnType<typeof readSmtp>>;
  deliveryEnabled: boolean;
}) {
  const { message } = App.useApp();
  const [pending, start] = useTransition();
  const [form] = Form.useForm();
  return (
    <>
      <Heading eyebrow="MAIL SETTINGS" title="邮件设置" subtitle="授权码加密保存，不会在页面回显。" />
      <div className="two-columns">
        <Card title="SMTP 配置">
          {!deliveryEnabled && (
            <Alert
              type="warning"
              showIcon
              title="当前部署未启用邮件投递，任务只入队、不实际发送。"
              style={{ marginBottom: 20 }}
            />
          )}
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              host: config?.host ?? 'smtp.qq.com',
              port: config?.port ?? 465,
              username: config?.username ?? '',
              from: config?.from ?? '',
              senderName: config?.senderName ?? '开奖追踪',
              recipients: config?.recipients.join(', ') ?? '',
              autoEnabled: config?.autoEnabled ?? false,
              password: '',
            }}
            onFinish={(v: Omit<SmtpInput, 'recipients'> & { recipients: string }) =>
              start(async () => {
                const r = await saveSmtpAction({
                  ...v,
                  recipients: v.recipients.split(/[,，;\s]+/).filter(Boolean),
                });
                if (r.ok) {
                  message.success('邮件设置已保存');
                  form.setFieldValue('password', '');
                } else message.error(r.error);
              })
            }
          >
            <div className="two-columns">
              <Form.Item name="host" label="SMTP 主机" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="port" label="安全连接" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 465, label: '465 · SSL/TLS' },
                    { value: 587, label: '587 · STARTTLS' },
                  ]}
                />
              </Form.Item>
            </div>
            <Form.Item name="username" label="邮箱账号" rules={[{ required: true }]}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="password" label={`新授权码${config?.hasPassword ? '（留空保持原值）' : ''}`}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <div className="two-columns">
              <Form.Item name="from" label="发件地址" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="senderName" label="发件人名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </div>
            <Form.Item name="recipients" label="默认收件人（逗号分隔）" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="autoEnabled" label="启用自动中奖通知" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={pending}>
                保存 SMTP 设置
              </Button>
              <Popconfirm
                title="发送配置测试邮件？"
                description="使用已保存的配置，发送到默认收件人。"
                onConfirm={() =>
                  start(async () => {
                    const r = await testSmtpAction();
                    if (r.ok) message.success('测试邮件已加入队列');
                    else message.error(r.error);
                  })
                }
              >
                <Button loading={pending}>发送测试邮件</Button>
              </Popconfirm>
            </Space>
          </Form>
        </Card>
        <Card title="配置说明">
          <div className="section-stack">
            <Alert
              type="info"
              title="QQ 邮箱"
              description="SMTP 主机 smtp.qq.com；推荐 465 / SSL-TLS。账号和发件地址填写完整 QQ 邮箱。密码栏填写邮箱设置中生成的 SMTP 授权码，不是 QQ 登录密码。"
            />
            <div>
              <h3>自动通知条件</h3>
              <p>本页启用自动通知、服务器启用投递，并且本期中奖金额已明确，才会发送。</p>
              <p>未中奖不发送；奖金缺失时等待官方数据补全，不估算浮动奖金额。</p>
            </div>
            <div>
              <h3>安全提醒</h3>
              <p>不支持明文 SMTP。请勿把授权码放入截图、操作手册或聊天记录。</p>
              <p>新版与旧版并行时，请只在一个系统启用自动通知，以免重复收信。</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
