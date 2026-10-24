import { getGroups } from '@/modules/groups/server/service';
import { GroupList } from '@/modules/groups/components/group-list';
import { requireActor } from '@/server/permissions';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('groups.read');
  return (
    <GroupList
      kind="FIXED"
      data={await getGroups('FIXED', await searchParams)}
      canWrite={actor.permissions.includes('groups.write')}
      canSend={actor.permissions.includes('mail.send')}
    />
  );
}
