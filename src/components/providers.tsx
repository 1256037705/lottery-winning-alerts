'use client';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');
/** 统一主题与消息上下文，禁止每个页面各自覆盖组件内部样式。 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      button={{ autoInsertSpace: false }}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorBgLayout: '#f5f7fa',
          borderRadius: 10,
          fontFamily: 'Inter, "Microsoft YaHei", sans-serif',
          controlHeight: 40,
        },
        components: {
          Table: { headerBg: '#f7f9fc' },
          Layout: { siderBg: '#fff', headerBg: '#fff' },
          Menu: { itemHeight: 44 },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
