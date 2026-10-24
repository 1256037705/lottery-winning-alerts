import { requireActor } from '@/server/permissions';
import { Rules } from '@/modules/lottery/rules';
export default async function Page() {
  await requireActor('draws.read');
  return <Rules />;
}
