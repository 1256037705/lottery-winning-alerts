/** 只在常驻 Node.js 服务运行；构建、测试和边缘运行时不启动后台任务。 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SCHEDULER_ENABLED === 'true') {
    const { startScheduler } = await import('./server/scheduler');
    startScheduler();
  }
}
