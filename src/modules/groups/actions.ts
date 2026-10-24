'use server';
import { perform } from '@/server/action';
import { saveGroup, changeGroup, groupHistory } from './server/service';
import { sendGroupTest } from '@/modules/mail/server/service';
export async function saveGroupAction(input: unknown) {
  return perform(() => saveGroup(input));
}
export async function changeGroupAction(input: unknown) {
  return perform(() => changeGroup(input));
}
export async function groupHistoryAction(id: unknown) {
  return perform(() => groupHistory(id));
}
export async function sendGroupAction(id: unknown) {
  return perform(() => sendGroupTest(id));
}
