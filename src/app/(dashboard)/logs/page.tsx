import { getMail } from '@/modules/mail/server/service';
import { MailList } from '@/modules/mail/components/mail-list';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return <MailList data={await getMail(await searchParams, true)} logs />;
}
