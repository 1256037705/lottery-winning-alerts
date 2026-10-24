import { readSmtp } from '@/modules/mail/server/settings';
import { MailSettings } from '@/modules/mail/components/settings';
export default async function Page() {
  return (
    <MailSettings config={await readSmtp()} deliveryEnabled={process.env.MAIL_DELIVERY_ENABLED === 'true'} />
  );
}
