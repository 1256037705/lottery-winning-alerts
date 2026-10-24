import { test, expect } from '@playwright/test';
import { testEnv } from '../environment';
import { dayString, drawDay } from '../../src/modules/lottery/schema';
test('未登录无法进入受保护页面', async ({ page }) => {
  await page.goto('/fixed');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
});
test('登录、创建编辑删除、日期筛选与移动导航', async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /hydrat/i.test(m.text())) hydrationErrors.push(m.text());
  });
  const name = `E2E-${Date.now()}`;
  await page.goto('/login');
  await page.getByLabel('账号', { exact: true }).fill(testEnv.BOOTSTRAP_USERNAME);
  await page.getByLabel('密码', { exact: true }).fill(testEnv.BOOTSTRAP_PASSWORD);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '开奖工作台' })).toBeVisible();
  await page.goto('/fixed');
  await page.getByRole('button', { name: '新增号码组' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('名称', { exact: true }).fill(name);
  await dialog.getByLabel('第1注红区第1个号码').fill('34');
  await expect(dialog.getByText('红区号码：只能输入 01–33')).toBeVisible();
  await dialog.getByRole('button', { name: '保存号码组' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('第1注红区第1个号码').fill('01');
  await expect(dialog.getByLabel('第1注红区第2个号码')).toBeFocused();
  await dialog.getByLabel('第1注红区第2个号码').fill('01');
  await expect(dialog.getByText('红区号码：号码重复')).toBeVisible();
  await dialog.getByLabel('第1注红区第2个号码').fill('02');
  for (const [position, value] of ['03', '04', '05', '06'].entries())
    await dialog.getByLabel(`第1注红区第${position + 3}个号码`).fill(value);
  await expect(dialog.getByLabel('第1注蓝区第1个号码')).toBeFocused();
  await dialog.getByLabel('第1注蓝区第1个号码').fill('07');
  await dialog.getByRole('button', { name: '保存号码组' }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(dialog.getByLabel('第1注红区第1个号码')).toHaveValue('01');
  await page.screenshot({ path: 'test-artifacts/number-editor.png', fullPage: true, caret: 'initial', animations: 'disabled' });
  await dialog.getByLabel('第1注蓝区第1个号码').fill('08');
  await dialog.getByRole('button', { name: '保存号码组' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText('V2');
  await row.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(row).not.toBeVisible();
  await page.goto('/results');
  await expect(page.getByLabel('起始日期', { exact: true })).toHaveAttribute('placeholder', 'YYYY-MM-DD');
  await page.getByLabel('起始日期', { exact: true }).fill('2026-10-01');
  await page.getByLabel('起始日期', { exact: true }).press('Enter');
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-10-01/);
  await expect(page.getByRole('columnheader', { name: '官方期号' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '来源', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '操作', exact: true })).toHaveCount(0);
  await page.goto('/temporary');
  await page.getByRole('button', { name: '新增号码组' }).click();
  await dialog.getByLabel('名称', { exact: true }).fill(`${name}-temporary`);
  await dialog.getByLabel('彩种', { exact: true }).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '超级大乐透' }).click();
  let future = new Date(`${dayString()}T00:00:00Z`);
  do {
    future = new Date(future.getTime() + 86400000);
  } while (!drawDay('DLT', future.toISOString().slice(0, 10)));
  await dialog.getByLabel('预计开奖日期', { exact: true }).fill(future.toISOString().slice(0, 10));
  await dialog.getByLabel('预计开奖日期', { exact: true }).press('Enter');
  for (const [position, value] of ['01', '02', '03', '04', '05'].entries())
    await dialog.getByLabel(`第1注红区第${position + 1}个号码`).fill(value);
  for (const [position, value] of ['06', '07'].entries())
    await dialog.getByLabel(`第1注蓝区第${position + 1}个号码`).fill(value);
  await dialog.getByRole('button', { name: '保存号码组' }).click();
  await expect(dialog).not.toBeVisible();
  const tempRow = page.getByRole('row').filter({ hasText: `${name}-temporary` });
  await expect(tempRow).toBeVisible();
  await tempRow.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(tempRow).not.toBeVisible();
  for (const [path, title] of [
    ['/mail-tasks', '邮件任务'],
    ['/logs', '发送日志'],
    ['/settings/mail', '邮件设置'],
    ['/settings/system', '系统状态'],
    ['/rules', '彩种与奖金规则'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await page.goto('/calendar?month=2026-03');
  await expect(page.getByText('星期一', { exact: true })).toBeVisible();
  await expect(page.getByText('第 9990001 期', { exact: true })).toBeVisible();
  // 截图不注入 caret-color 内联样式，避免在 React hydration 期间改变 DOM。
  await page.screenshot({ path: 'test-artifacts/calendar-desktop.png', fullPage: true, caret: 'initial' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '展开导航' }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: '固定号码', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: '固定号码', exact: true }).click();
  await expect(page.getByRole('heading', { name: '固定号码' })).toBeVisible();
  await page.getByRole('button', { name: '新增号码组' }).click();
  await expect(dialog.getByLabel('第1注红区第1个号码')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (let i = 0; i < 5; i++) await dialog.getByRole('button', { name: '添加一注' }).click();
  const editorBody = dialog.locator('.ant-modal-body');
  const bodyLayout = await editorBody.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    modalClass: element.closest('.ant-modal')?.className,
    viewportHeight: window.innerHeight,
  }));
  expect(bodyLayout.scrollHeight, JSON.stringify(bodyLayout)).toBeGreaterThan(bodyLayout.clientHeight);
  await dialog.getByLabel('第6注红区第1个号码').scrollIntoViewIfNeeded();
  await expect(dialog.getByLabel('第6注红区第1个号码')).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '保存号码组' })).toBeInViewport();
  await page.screenshot({ path: 'test-artifacts/fixed-mobile.png', fullPage: true, caret: 'initial', animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 700 });
  await dialog.getByLabel('第6注红区第1个号码').scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: '保存号码组' })).toBeInViewport();
  await page.screenshot({ path: 'test-artifacts/fixed-many-tickets.png', fullPage: true, caret: 'initial', animations: 'disabled' });
  await dialog.getByRole('button', { name: '取消' }).click();
  expect(hydrationErrors).toEqual([]);
});
test('错误密码不进入后台，公开注册关闭', async ({ request, page }) => {
  const register = await request.post('/api/auth/sign-up/email', {
    data: { name: 'unknown', email: 'unknown@example.invalid', password: 'Wrong-Password-2026' },
    headers: { Origin: 'http://127.0.0.1:3100' },
  });
  expect(register.ok()).toBe(false);
  await page.goto('/login');
  await page.getByLabel('账号', { exact: true }).fill(testEnv.BOOTSTRAP_USERNAME);
  await page.getByLabel('密码', { exact: true }).fill('Wrong-Password-2026');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('登录失败，请检查账号密码；连续失败请稍后重试')).toBeVisible();
});
