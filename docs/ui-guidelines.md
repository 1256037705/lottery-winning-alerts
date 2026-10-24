# UI 规范

以用户新 AGENTS.md 为准使用 Ant Design，不再混用旧 Arco Design 风格组件。保留现代 SaaS 和 Bento 的空间组织方式，但组件、主题和交互统一。

## 布局与主题

左侧白色导航、顶部身份/时区工具区、浅灰内容底、白色卡片。主色 #1677FF，背景 #F5F7FA，圆角 10px。ConfigProvider 统一 Design Tokens；不覆盖 Ant Design 私有内部 class。宽屏 224px 侧栏，小屏改 Drawer。

仪表盘 4 个统计卡，大屏双列趋势和规则卡；窄屏自动折叠。列表使用 Table，支持横向滚动和分页，不把多个字段挤进“期次”一列。

## 输入

日期全部用 Ant Design DatePicker，format 和 placeholder 固定 YYYY-MM-DD；支持直接输入和选择。月份 YYYY-MM。不再使用原生 input[type=date] 的混合语言占位符。

号码编辑使用 Modal，一行一注、红蓝独立输入、增删行。提供范围提示、字段标签、键盘可达按钮和保存中反馈。

## 状态

查询：Loading / Empty / Error；写入：pending / success / validation / forbidden / conflict。删除和发送测试必须二次确认。权限由服务端保证，UI 隐藏仅用于减少误操作。

## 日历

七列月视图，日期数字 20px，今日蓝色圆底；双色球红标签、大乐透蓝标签。历史期号和号码显示在对应日期下，未来标记“预计开奖、期号待确认”。手机保留单元格最小可读宽度并横向滚动。

## 可视化和无障碍

ECharts 动态客户端加载，明确空数据和错误状态。真实金额在服务端用 Decimal/整数分；图表数值只用于绘制坐标。红蓝球同时有标签，不仅凭颜色识别。导航跳转、图标按钮和日期输入具有辅助标签。
