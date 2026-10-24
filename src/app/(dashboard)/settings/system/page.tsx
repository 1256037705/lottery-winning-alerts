import { systemStatus } from '@/modules/system/service';
import { SystemStatus } from '@/modules/system/status';
export default async function Page() {
  return <SystemStatus data={await systemStatus()} />;
}
