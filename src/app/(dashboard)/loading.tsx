'use client';
import { Skeleton, Card } from 'antd';
export default function Loading() {
  return (
    <Card>
      <Skeleton active paragraph={{ rows: 8 }} />
    </Card>
  );
}
