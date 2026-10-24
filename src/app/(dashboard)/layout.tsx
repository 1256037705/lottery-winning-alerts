import { redirect } from 'next/navigation';
import { requireActor } from '@/server/permissions';
import { BusinessError } from '@/lib/errors';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let actor;
  try {
    actor = await requireActor();
  } catch (e) {
    if (e instanceof BusinessError && e.code === 'UNAUTHORIZED') redirect('/login');
    throw e;
  }
  return (
    <Shell name={actor.name} permissions={actor.permissions}>
      {children}
    </Shell>
  );
}
