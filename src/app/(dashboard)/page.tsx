import { dashboard } from '@/modules/draws/server/service';
import { Dashboard } from '@/modules/draws/components/dashboard';
export default async function Page() {
  return <Dashboard data={await dashboard()} />;
}
