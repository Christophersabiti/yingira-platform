import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { appOrigin, encryptionKey, publicConfig } from './config';
import { openToken } from '@/lib/tokens';
import type { ApprovalView, CommerceState } from '@/lib/commerce';
export function commerceLinks(
  raw: Omit<CommerceState, 'approvals'> & {
    approvals: (CommerceState['approvals'][number] & { ciphertext?: string })[];
  },
): CommerceState {
  return {
    ...raw,
    approvals: raw.approvals.map(({ ciphertext, ...a }) => {
      for (const secret of [
        encryptionKey(),
        process.env.INVITATION_PREVIOUS_ENCRYPTION_KEY,
      ].filter(Boolean)) {
        try {
          return {
            ...a,
            link: `${appOrigin()}/client/${openToken(ciphertext || '', secret!)}`,
          };
        } catch {}
      }
      return a;
    }),
  };
}
// Fixed service-only portal boundary; no arbitrary table names or RPC names from clients.
export async function clientPortal(
  token: string,
  action: 'view' | 'decide' = 'view',
  data: Record<string, unknown> = {},
): Promise<ApprovalView | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const db = createClient(
    publicConfig().url,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const r = await db.rpc('yingira_client_portal', {
    p_token: token,
    p_action: action,
    p_data: data,
  });
  if (r.error)
    throw Error(
      r.error.code === 'P0001' ? r.error.message : 'Client portal unavailable.',
    );
  return r.data;
}
