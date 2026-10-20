import { request } from './client';

/** Revoke the cookie session before cleanup can broadcast or navigate away. */
export async function logoutAndClearDevice(clearDevice: () => Promise<void>): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' });
  // A local cache/push cleanup failure must not undo a successful server logout.
  await clearDevice().catch(() => undefined);
}
