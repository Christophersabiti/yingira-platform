import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { appOrigin, encryptionKey, publicConfig } from './config';
import { invitationLinks } from '@/lib/tokens';
export function emailReady() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
function adapter() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw Error('Service unavailable');
  return createClient(publicConfig().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function worker(action: string, data: Record<string, unknown>) {
  const r = await adapter().rpc('yingira_mail_worker', {
    p_action: action,
    p_data: data,
  });
  if (r.error) throw Error('Email queue unavailable');
  return r.data;
}
export async function processMail(eventId?: string) {
  if (!emailReady())
    throw Error(
      'Email sending is not connected. Configure a verified sender and provider API key.',
    );
  let processed = 0;
  const stopAt = Date.now() + 45000;
  for (let i = 0; i < 10 && Date.now() < stopAt; i++) {
    if (i) await new Promise((resolve) => setTimeout(resolve, 600));
    const m = await worker('claim', { eventId });
    if (!m) break;
    if (m.skipped) continue;
    try {
      let payload = m.payload;
      if (!payload) {
        const links = invitationLinks(
          [{ id: m.id, token_ciphertext: m.ciphertext }],
          appOrigin(),
          [
            encryptionKey(),
            process.env.INVITATION_PREVIOUS_ENCRYPTION_KEY || '',
          ].filter(Boolean),
        );
        if (!links[m.id]) {
          await worker('complete', {
            id: m.id,
            status: 'failed',
            error: 'Invitation link unavailable; reissue the invitation.',
          });
          continue;
        }
        payload = {
          from: process.env.EMAIL_FROM,
          to: [m.recipient],
          subject: m.subject,
          text: `Dear ${m.name},\n\n${m.message}\n\n${m.title}\n${new Date(m.startsAt).toLocaleString('en-GB', { timeZone: m.timezone })}\n${m.venue}\n\nView your private invitation and respond:\n${links[m.id]}\n\nPlease keep your personal invitation link private. Contact your host if you no longer wish to receive event messages.`,
        };
        await worker('payload', { id: m.id, payload });
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `yingira-${m.id}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 429 || res.status >= 500) break; // Retain the same key and frozen payload for recovery.
      if (!res.ok) {
        await worker('complete', {
          id: m.id,
          status: 'failed',
          error: `Provider rejected request (${res.status}). Check sender and recipient configuration.`,
        });
        continue;
      }
      const sent = await res.json();
      if (typeof sent.id !== 'string') break;
      await worker('complete', {
        id: m.id,
        status: 'accepted',
        providerId: sent.id,
      });
      processed++;
    } catch {
      break;
    } // Unknown transport results remain leased; never invent delivery.
  }
  return { processed };
}
export async function trackMail(eventId: string) {
  if (!emailReady()) throw Error('Email sending is not connected.');
  const messages = await worker('track', { eventId });
  let checked = 0;
  const stopAt = Date.now() + 45000;
  for (const m of messages) {
    if (Date.now() >= stopAt) break;
    if (checked) await new Promise((resolve) => setTimeout(resolve, 600));
    const r = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(m.providerId)}`,
      {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!r.ok) break;
    const d = await r.json();
    const status = (
      {
        delivered: 'delivered',
        opened: 'delivered',
        clicked: 'delivered',
        bounced: 'bounced',
        complained: 'complained',
        failed: 'failed',
      } as Record<string, string>
    )[d.last_event];
    await worker('complete', {
      id: m.id,
      status: status || m.status || 'accepted',
    });
    checked++;
  }
  return { checked };
}
