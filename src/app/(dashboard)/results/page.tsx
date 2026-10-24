import { getDraws } from '@/modules/draws/server/service';
import { Results } from '@/modules/draws/components/results';
import { requireActor } from '@/server/permissions';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('draws.read');
  return (
    <Results data={await getDraws(await searchParams)} canSync={actor.permissions.includes('draws.write')} />
  );
}
