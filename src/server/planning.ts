import 'server-only';
import { supabase } from './supabase';
import { appOrigin } from './config';
export async function planningDb(eventId: string) {
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw Error('Sign in to continue.');
  const check = await db.rpc('yingira_command', {
    p_action: 'event',
    p_data: { eventId },
  });
  if (check.error || !check.data?.isAdmin)
    throw Error('Administrator access required.');
  return db;
}
export function requireOrigin(request: Request) {
  if (request.headers.get('origin') !== appOrigin())
    throw Error('Request not allowed.');
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw Error('Upload too large.');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Empty request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw Error('Upload too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
