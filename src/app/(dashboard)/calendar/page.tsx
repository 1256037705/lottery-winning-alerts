import dayjs from 'dayjs';
import { getDraws } from '@/modules/draws/server/service';
import { DrawCalendar } from '@/modules/draws/components/calendar';
import { dayString } from '@/modules/lottery/schema';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month ?? '') ? q.month : dayString().slice(0, 7);
  const first = dayjs(`${month}-01`);
  const data = await getDraws(
    {
      from: first.subtract(7, 'day').format('YYYY-MM-DD'),
      to: first.add(1, 'month').add(7, 'day').format('YYYY-MM-DD'),
      lottery: q.lottery,
    },
    true,
  );
  return <DrawCalendar rows={data.rows} month={month} />;
}
