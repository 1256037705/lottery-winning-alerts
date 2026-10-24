'use server';
import { perform } from '@/server/action';
import { saveSmtp } from './server/settings';
import { testSmtp } from './server/service';
export async function saveSmtpAction(input: unknown) {
  return perform(() => saveSmtp(input));
}
export async function testSmtpAction() {
  return perform(testSmtp);
}
