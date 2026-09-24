import { billingSchema } from '@/lib/billing';
import { boundedBody, requireOrigin } from '@/server/planning';
import { supabase } from '@/server/supabase';
import {
  billingState,
  pesapalConfig,
  submitPesapal,
  verifyPesapal,
} from '@/server/pesapal';
import { encryptionKey } from '@/server/config';
import { issueToken } from '@/lib/tokens';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const parsed = billingSchema.safeParse(
      JSON.parse((await boundedBody(request, 15000)).toString()),
    );
    if (!parsed.success)
      return Response.json(
        { message: 'Check the billing form fields.' },
        { status: 422 },
      );
    const input = parsed.data;
    const { action, ...data } = input;
    const db = await supabase();
    const auth = await db.auth.getUser();
    if (!auth.data.user)
      return Response.json(
        { message: 'Sign in to continue.' },
        { status: 401 },
      );
    if (input.action === 'process_order' || input.action === 'verify_order') {
      const access = await db.rpc('yingira_billing', {
        p_action: 'order_access',
        p_data: data,
      });
      if (access.error) throw Error('Order access denied.');
      return Response.json(
        input.action === 'process_order'
          ? await submitPesapal(input.id)
          : await verifyPesapal(input.id, input.trackingId),
      );
    }
    if (action === 'subscription_order') {
      const state = await db.rpc('yingira_billing', {
        p_action: 'state',
        p_data: { eventId: data.eventId },
      });
      if (
        state.error ||
        !pesapalConfig('subscription', state.data.organizationId)
      )
        throw Error('Pesapal subscription billing is not connected.');
    }
    let extra = {};
    if (action === 'invoice_link') {
      const t = issueToken(encryptionKey());
      extra = { tokenHash: t.tokenHash, tokenCiphertext: t.tokenCiphertext };
    }
    const r = await db.rpc('yingira_billing', {
      p_action: action,
      p_data: { ...data, ...extra },
    });
    if (r.error)
      throw Error(
        r.error.code === 'P0001'
          ? r.error.message
          : 'Billing access denied or details changed.',
      );
    return Response.json(action === 'state' ? billingState(r.data) : r.data);
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'Billing unavailable.' },
      { status: 400 },
    );
  }
}
