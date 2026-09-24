import 'server-only';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { appOrigin, encryptionKey, publicConfig } from './config';
import { openToken } from '@/lib/tokens';
import type { BillingState, PayView } from '@/lib/billing';
const merchantSchema = z.object({
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
  notificationId: z.string().uuid(),
  mode: z.enum(['sandbox', 'live']),
});
type Merchant = z.infer<typeof merchantSchema>;
export function pesapalConfig(
  purpose: 'invoice' | 'subscription',
  organizationId: string,
): Merchant | null {
  try {
    const value =
      purpose === 'subscription'
        ? JSON.parse(process.env.PESAPAL_PLATFORM_CONFIG || 'null')
        : (
            JSON.parse(process.env.PESAPAL_MERCHANTS || '{}') as Record<
              string,
              unknown
            >
          )[organizationId];
    const parsed = merchantSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
function db() {
  return createClient(publicConfig().url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function worker(action: string, data: Record<string, unknown>) {
  const r = await db().rpc('yingira_pesapal_worker', {
    p_action: action,
    p_data: data,
  });
  if (r.error) throw Error('Payment record requires review.');
  return r.data;
}
export async function invoiceCheckout(
  token: string,
  action: 'view' | 'order',
  data: Record<string, unknown> = {},
): Promise<PayView | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const r = await db().rpc('yingira_invoice_checkout', {
    p_token: token,
    p_action: action,
    p_data: data,
  });
  if (r.error)
    throw Error(
      r.error.code === 'P0001' ? r.error.message : 'Invoice unavailable.',
    );
  return r.data;
}
export function billingState(
  raw: Omit<
    BillingState,
    | 'platformReady'
    | 'merchantReady'
    | 'platformMode'
    | 'merchantMode'
    | 'invoiceLinks'
  > & {
    invoiceLinks: (BillingState['invoiceLinks'][number] & {
      ciphertext: string;
    })[];
  },
): BillingState {
  const platform = pesapalConfig('subscription', raw.organizationId),
    merchant = pesapalConfig('invoice', raw.organizationId);
  return {
    ...raw,
    platformReady: !!platform,
    merchantReady: !!merchant,
    platformMode: platform?.mode || '',
    merchantMode: merchant?.mode || '',
    invoiceLinks: raw.invoiceLinks.map(({ ciphertext, ...l }) => {
      for (const secret of [
        encryptionKey(),
        process.env.INVITATION_PREVIOUS_ENCRYPTION_KEY,
      ].filter(Boolean)) {
        try {
          return {
            ...l,
            link: `${appOrigin()}/pay/${openToken(ciphertext, secret!)}`,
          };
        } catch {}
      }
      return l;
    }),
  };
}
function base(config: Merchant) {
  return config.mode === 'live'
    ? 'https://pay.pesapal.com/v3/api'
    : 'https://cybqa.pesapal.com/pesapalv3/api';
}
async function auth(config: Merchant) {
  const r = await fetch(base(config) + '/Auth/RequestToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      consumer_key: config.consumerKey,
      consumer_secret: config.consumerSecret,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const d = await r.json();
  if (!r.ok || typeof d.token !== 'string' || !d.token)
    throw Error('Pesapal authentication failed. Check merchant setup.');
  return d.token as string;
}
function redirectAllowed(url: string, config: Merchant) {
  const u = new URL(url);
  return (
    u.protocol === 'https:' &&
    u.hostname ===
      (config.mode === 'live' ? 'pay.pesapal.com' : 'cybqa.pesapal.com') &&
    !u.username &&
    !u.password
  );
}
export async function submitPesapal(id: string) {
  const read = await worker('read', { id });
  if (!read) throw Error('Order unavailable.');
  const config = pesapalConfig(read.purpose, read.organization_id);
  if (!config) throw Error('Pesapal is not connected for this merchant.');
  // Authenticate before claiming: a credential failure must not leave an uncertain submitted order.
  const token = await auth(config);
  const order = await worker('claim', { id, mode: config.mode });
  if (!order.claimed) {
    if (
      order.redirectUrl &&
      redirectAllowed(order.redirectUrl, config) &&
      order.status === 'pending'
    )
      return { redirectUrl: order.redirectUrl };
    throw Error(
      order.status === 'completed'
        ? 'This payment is complete.'
        : 'Payment submission is pending or uncertain. Refresh its status before starting another payment.',
    );
  }
  try {
    const response = await fetch(
      base(config) + '/Transactions/SubmitOrderRequest',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          id: order.id,
          currency: order.currency,
          amount: order.amount,
          description:
            order.purpose === 'invoice'
              ? `Invoice ${order.details.number}`
              : `Yingira ${order.details.name}`.slice(0, 100),
          callback_url: `${appOrigin()}/payments/return`,
          cancellation_url: `${appOrigin()}/payments/return`,
          notification_id: config.notificationId,
          billing_address: {
            email_address: order.customer_email,
            phone_number: order.customer_phone,
            country_code: 'UG',
            first_name: order.customer_name,
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const result = await response.json();
    if (
      !response.ok ||
      result.merchant_reference !== id ||
      !z.string().uuid().safeParse(result.order_tracking_id).success ||
      typeof result.redirect_url !== 'string' ||
      !redirectAllowed(result.redirect_url, config)
    )
      throw Error('Payment submission was not confirmed.');
    await worker('submitted', {
      id,
      trackingId: result.order_tracking_id,
      redirectUrl: result.redirect_url,
    });
    return { redirectUrl: result.redirect_url as string };
  } catch {
    await worker('uncertain', { id });
    throw Error(
      'Pesapal submission is uncertain. Do not pay again; ask the Admin to reconcile this order.',
    );
  }
}
export async function verifyPesapal(
  id: string,
  trackingId?: string,
): Promise<{ status: string; mode?: string }> {
  const order = await worker('read', { id });
  if (!order) throw Error('Order unavailable.');
  const tracking = trackingId || order.tracking_id;
  if (!z.string().uuid().safeParse(tracking).success)
    throw Error(
      'Tracking ID is not yet available. Contact the merchant to reconcile.',
    );
  if (order.tracking_id && order.tracking_id !== tracking)
    throw Error('Tracking ID mismatch.');
  const config = pesapalConfig(order.purpose, order.organization_id);
  if (!config) throw Error('Pesapal is not connected.');
  const token = await auth(config);
  const r = await fetch(
    base(config) +
      `/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(tracking)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    },
  );
  const d = await r.json();
  if (
    !r.ok ||
    String(d.status) !== '200' ||
    d.merchant_reference !== id ||
    d.currency !== 'UGX' ||
    !Number.isSafeInteger(Number(d.amount)) ||
    Number(d.amount) !== order.amount
  )
    throw Error('Pesapal verification did not match the recorded payment.');
  const status = (
    { 0: 'pending', 1: 'completed', 2: 'failed', 3: 'reversed' } as Record<
      string,
      string
    >
  )[String(d.status_code)];
  if (!status) throw Error('Unknown Pesapal payment status.');
  return worker('settle', {
    id,
    trackingId: tracking,
    amount: Number(d.amount),
    currency: d.currency,
    status,
    confirmation: String(d.confirmation_code || ''),
    mode: config.mode,
  });
}
