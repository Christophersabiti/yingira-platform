import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicConfig } from './config';
import type { PublicInvitation } from '@/lib/contracts';
// Isolated privileged adapter: never export this client or accept arbitrary RPC names.
export async function invitation(
  token: string,
): Promise<PublicInvitation | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Public invitation access is not configured');
  const { url } = publicConfig();
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc('yingira_public_invitation', {
    p_token: token,
  });
  if (error) throw new Error('Invitation service unavailable');
  return data;
}
