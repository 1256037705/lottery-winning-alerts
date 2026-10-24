'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Button, Drawer, Space, Tag, App } from 'antd';
import {
  DashboardOutlined,
  NumberOutlined,
  PlusCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  BookOutlined,
  MailOutlined,
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { authClient } from '@/lib/auth-client';

const links = [
  { key: '/', label: '仪表盘', icon: <DashboardOutlined /> },
  { key: '/fixed', label: '固定号码', icon: <NumberOutlined /> },
  { key: '/temporary', label: '临时号码', icon: <PlusCircleOutlined /> },
  { key: '/calendar', label: '开奖日历', icon: <CalendarOutlined /> },
  { key: '/results', label: '开奖结果', icon: <CheckCircleOutlined /> },
  { key: '/rules', label: '彩种规则', icon: <BookOutlined /> },
  { key: '/mail-tasks', label: '邮件任务', icon: <MailOutlined /> },
  { key: '/logs', label: '发送日志', icon: <FileTextOutlined /> },
  { key: '/settings/mail', label: '邮件设置', icon: <SettingOutlined /> },
  { key: '/settings/system', label: '系统状态', icon: <SafetyOutlined /> },
];
export function Shell({
  children,
  name,
  permissions,
}: {
  children: React.ReactNode;
  name: string;
  permissions: string[];
}) {
  const path = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const nav = (
    <>
      <div className="brand">
        <span className="brand-mark">开</span>
        <div>
          开奖追踪<small>LOTTERY WORKSPACE</small>
        </div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[path]}
        items={links
          .filter((l) => !l.key.startsWith('/settings') || permissions.includes('settings.write'))
          .map((l) => ({
            ...l,
            label: (
              <Link href={l.key} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ),
          }))}
      />
    </>
  );
  return (
    <Layout className="app-shell">
      <a href="#main-content" className="skip-link">
        跳至主要内容
      </a>
      <Layout.Sider width={224} theme="light" className="desktop-sider">
        {nav}
      </Layout.Sider>
      <Drawer
        placement="left"
        open={open}
        onClose={() => setOpen(false)}
        styles={{ body: { padding: 0 } }}
        title="导航"
      >
        {nav}
      </Drawer>
      <Layout>
        <Layout.Header className="shell-header">
          <Space>
            <Button
              className="mobile-menu"
              aria-label="展开导航"
              icon={<MenuOutlined />}
              onClick={() => setOpen(true)}
            />
            <span className="muted header-breadcrumb">数据工作台 / 开奖追踪</span>
          </Space>
          <Space>
            <Tag color="blue">Asia/Shanghai</Tag>
            <span>{name}</span>
            <Button
              aria-label="退出登录"
              type="text"
              icon={<LogoutOutlined />}
              onClick={async () => {
                const r = await authClient.signOut();
                if (r.error) message.error('退出失败，请重试');
                else {
                  router.push('/login');
                  router.refresh();
                }
              }}
            />
          </Space>
        </Layout.Header>
        <Layout.Content>
          <main id="main-content" className="workspace">
            {children}
            <footer className="app-footer">
              预计日历不代表官方开奖安排 · 追踪号码不代表实际购买 · 奖金为税前参考，以官方公告和兑奖为准
            </footer>
          </main>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
