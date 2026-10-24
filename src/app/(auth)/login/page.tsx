'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Form, Input } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { authClient } from '@/lib/auth-client';
export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(values: { username: string; password: string }) {
    setLoading(true);
    setError('');
    try {
      const result = await authClient.signIn.username(values);
      if (result.error) setError('登录失败，请检查账号密码；连续失败请稍后重试');
      else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('连接失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-screen">
      <section className="login-story">
        <div className="eyebrow" style={{ color: '#adcaff' }}>
          LOTTERY WORKSPACE
        </div>
        <h1>
          每期开奖，
          <br />
          清晰掌握。
        </h1>
        <p>
          让号码追踪井然有序。
          <br />
          从开奖日历到中奖通知，在一个工作台内完成。
        </p>
        <p>只在中奖时自动通知 · 手动测试随时可用</p>
      </section>
      <section className="login-form">
        <div className="login-card">
          <div className="eyebrow">WELCOME BACK</div>
          <h1>登录开奖追踪</h1>
          <p className="muted">使用管理员分配的账号进入工作台。</p>
          {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 20 }} />}
          <Form layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
              <Input prefix={<UserOutlined />} autoComplete="username" size="large" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" size="large" />
            </Form.Item>
            <Button block type="primary" size="large" htmlType="submit" loading={loading}>
              登录
            </Button>
          </Form>
          <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
            账号由管理员初始化；本系统不提供公开注册。
          </p>
        </div>
      </section>
    </div>
  );
}
