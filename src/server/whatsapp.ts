import 'server-only';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { appOrigin, encryptionKey, publicConfig } from './config';
import { openToken } from '@/lib/tokens';
import type { WhatsAppState } from '@/lib/whatsapp';
const sid = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}[0-9a-fA-F]{32}$`));
const configSchema = z.object({
  accountSid: sid('AC'),
  authToken: z.string().min(16),
  from: z.string().regex(/^whatsapp:\+[1-9]\d{7,14}$/),
  invitationTemplate: sid('HX'),
  reminderTemplate: sid('HX'),
});
type Config = z.infer<typeof configSchema>;
export function whatsappAccounts(): Record<string, Config> {
  try {
    const raw = JSON.parse(process.env.WHATSAPP_ACCOUNTS || '{}');
    const result: Record<string, Config> = {};
    for (const [id, value] of Object.entries(raw)) {
      const c = configSchema.safeParse(value);
      if (z.string().uuid().safeParse(id).success && c.success)
        result[id] = c.data;
    }
    return result;
  } catch {
    return {};
  }
}
export function whatsappState(
  data: Omit<WhatsAppState, 'configured' | 'sender'>,
): WhatsAppState {
  const c = whatsappAccounts()[data.organizationId];
  return {
    ...data,
    configured: !!c,
    sender: c?.from.replace('whatsapp:', '') || '',
  };
}
export async function whatsappWorker(
  action: 'claim' | 'context' | 'status' | 'stop',
  data: Record<string, unknown>,
) {
  const db = createClient(
    publicConfig().url,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const r = await db.rpc('yingira_whatsapp_worker', {
    p_action: action,
    p_data: data,
  });
  if (r.error) throw Error('WhatsApp queue unavailable.');
  return r.data;
}
export function validTwilioSignature(
  url: string,
  params: URLSearchParams,
  signature: string,
  secret: string,
) {
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) return false;
  const text =
    url +
    keys
      .sort()
      .map((k) => k + params.get(k))
      .join('');
  const expected = createHmac('sha1', secret).update(text).digest('base64');
  const a = Buffer.from(expected),
    b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function deliveryStatus(status: string) {
  return (
    {
      queued: 'accepted',
      accepted: 'accepted',
      sending: 'accepted',
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
      undelivered: 'failed',
    } as Record<string, string>
  )[status];
}
export async function dispatchWhatsApp(eventId?: string) {
  const accounts = whatsappAccounts(),
    organizations = Object.keys(accounts);
  if (!organizations.length) return { processed: 0 };
  let processed = 0;
  const stop = Date.now() + 45000;
  for (let i = 0; i < 30 && Date.now() < stop; i++) {
    const m = await whatsappWorker('claim', { eventId, organizations });
    if (!m) break;
    if (m.skipped) continue;
    const config = accounts[m.organizationId];
    let token = '';
    for (const k of [
      encryptionKey(),
      process.env.INVITATION_PREVIOUS_ENCRYPTION_KEY,
    ].filter(Boolean)) {
      try {
        token = openToken(m.ciphertext, k!);
        break;
      } catch {}
    }
    if (
      !token ||
      !config ||
      ![config.invitationTemplate, config.reminderTemplate].includes(
        m.templateSid,
      )
    ) {
      await whatsappWorker('status', {
        id: m.id,
        status: 'failed',
        error: 'Invitation or approved template is unavailable.',
      });
      continue;
    }
    try {
      const body = new URLSearchParams({
        To: `whatsapp:${m.phone}`,
        From: config.from,
        ContentSid: m.templateSid,
        ContentVariables: JSON.stringify({
          '1': m.name,
          '2': m.title,
          '3': `${appOrigin()}/i/${token}`,
        }),
        StatusCallback: `${appOrigin()}/api/whatsapp/webhook?message=${m.id}`,
      });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
                'base64',
              ),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) {
        await whatsappWorker('status', {
          id: m.id,
          status: response.status >= 500 ? 'unknown' : 'failed',
          error: `Provider response ${response.status}. Review before retrying.`,
        });
        continue;
      }
      const d = await response.json();
      if (
        !sid('SM').safeParse(d.sid).success &&
        !sid('MM').safeParse(d.sid).success
      )
        throw Error();
      await whatsappWorker('status', {
        id: m.id,
        status: 'accepted',
        providerId: d.sid,
      });
      processed++;
    } catch {
      await whatsappWorker('status', {
        id: m.id,
        status: 'unknown',
        error:
          'Provider outcome uncertain. Review provider logs; automatic resend is disabled.',
      });
    }
  }
  return { processed };
}
