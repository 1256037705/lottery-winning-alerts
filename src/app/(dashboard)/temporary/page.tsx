import { getGroups } from '@/modules/groups/server/service';
import { GroupList } from '@/modules/groups/components/group-list';
import { requireActor } from '@/server/permissions';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('groups.read');
  return (
    <GroupList
      kind="TEMP"
      data={await getGroups('TEMP', await searchParams)}
      canWrite={actor.permissions.includes('groups.write')}
      canSend={false}
    />
  );
}
