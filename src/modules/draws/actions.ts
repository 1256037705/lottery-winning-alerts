'use server';
import { perform } from '@/server/action';
import { syncDraws } from './server/service';
export async function syncDrawsAction() {
  return perform(syncDraws);
}
