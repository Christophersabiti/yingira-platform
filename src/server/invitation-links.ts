import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appOrigin, encryptionKey, publicConfig } from './config';
import { openToken } from '@/lib/tokens';
import { shareSlugPattern } from '@/lib/invitation-links';

export async function eventShareLinks(
  db: SupabaseClient,
  eventId: string,
): Promise<Record<string, string>> {
  const { data, error } = await db.rpc('yingira_guest_share_links', {
    p_event_id: eventId,
  });
  if (error) throw Error('Guest URLs are unavailable. Please try again.');
  return Object.fromEntries(
    Object.entries(data as Record<string, string>).map(([id, slug]) => [
      id,
      `${appOrigin()}/${slug}`,
    ]),
  );
}
async function resolve(
  input: { p_token: string } | { p_slug: string },
): Promise<{ slug: string; ciphertext: string } | null> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw Error('Invitation links are not configured');
  const db = createClient(publicConfig().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc('yingira_resolve_share_link', input);
  if (error) throw Error('Invitation link service unavailable');
  return data;
}
export async function shareUrlForToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await resolve({ p_token: token });
  return result ? `${appOrigin()}/${result.slug}` : null;
}
export async function tokenForShareSlug(slug: string): Promise<string | null> {
  if (!shareSlugPattern.test(slug)) return null;
  const result = await resolve({ p_slug: slug });
  if (!result) return null;
  for (const key of [
    encryptionKey(),
    process.env.INVITATION_PREVIOUS_ENCRYPTION_KEY,
  ].filter((key): key is string => !!key)) {
    try {
      return openToken(result.ciphertext, key);
    } catch {
      /* Try retained key. */
    }
  }
  return null;
}
