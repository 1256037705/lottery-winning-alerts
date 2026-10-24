'use client';
import { Result, Button } from 'antd';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Result
      status="warning"
      title="暂时无法载入此页面"
      subTitle="请检查登录状态、访问权限或数据库连接后重试。"
      extra={<Button onClick={reset}>重试</Button>}
    />
  );
}
