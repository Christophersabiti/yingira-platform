import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { issueToken } from '@/lib/tokens';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
import {
  deliveryStatus,
  dispatchWhatsApp,
  validTwilioSignature,
} from '@/server/whatsapp';
const org = '10000000-0000-4000-8000-000000000002',
  id = '10000000-0000-4000-8000-000000000001',
  key = Buffer.alloc(32, 1).toString('base64');
beforeEach(() => {
  vi.restoreAllMocks();
  mocks.rpc.mockReset();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test');
  vi.stubEnv('APP_ORIGIN', 'https://yingira.test');
  vi.stubEnv('INVITATION_ENCRYPTION_KEY', key);
  vi.stubEnv(
    'WHATSAPP_ACCOUNTS',
    JSON.stringify({
      [org]: {
        accountSid: 'AC' + 'a'.repeat(32),
        authToken: 'test-secret-123456789',
        from: 'whatsapp:+256700000001',
        invitationTemplate: 'HX' + 'b'.repeat(32),
        reminderTemplate: 'HX' + 'c'.repeat(32),
      },
    }),
  );
});
describe('WhatsApp provider boundary', () => {
  it('validates the entire webhook URL and signed form parameters', () => {
    const url = 'https://yingira.test/api/whatsapp/webhook?message=123';
    const params = new URLSearchParams(
      'MessageStatus=delivered&MessageSid=SM123',
    );
    const signature = createHmac('sha1', 'secret')
      .update(url + 'MessageSidSM123MessageStatusdelivered')
      .digest('base64');
    expect(validTwilioSignature(url, params, signature, 'secret')).toBe(true);
    expect(validTwilioSignature(url + '4', params, signature, 'secret')).toBe(
      false,
    );
    params.set('MessageStatus', 'read');
    expect(validTwilioSignature(url, params, signature, 'secret')).toBe(false);
    params.append('MessageStatus', 'delivered');
    expect(validTwilioSignature(url, params, signature, 'secret')).toBe(false);
  });
  it('distinguishes acceptance, delivery and read receipts', () => {
    expect(deliveryStatus('queued')).toBe('accepted');
    expect(deliveryStatus('delivered')).toBe('delivered');
    expect(deliveryStatus('read')).toBe('read');
    expect(deliveryStatus('bogus')).toBeUndefined();
  });
  it('never blindly retries a lost provider response', async () => {
    let claims = 0;
    mocks.rpc.mockImplementation(
      async (_n: string, p: { p_action: string }) => ({
        error: null,
        data:
          p.p_action === 'claim'
            ? claims++ === 0
              ? {
                  id,
                  organizationId: org,
                  phone: '+256700000002',
                  name: 'Guest',
                  title: 'Test Event',
                  ciphertext: issueToken(key).tokenCiphertext,
                  templateSid: 'HX' + 'b'.repeat(32),
                }
              : null
            : { ok: true },
      }),
    );
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(Error('timeout'));
    vi.stubGlobal('fetch', fetch);
    await dispatchWhatsApp();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      mocks.rpc.mock.calls.some(
        (c) => c[1].p_action === 'status' && c[1].p_data.status === 'unknown',
      ),
    ).toBe(true);
  });
  it('does not contact a provider when no account is configured', async () => {
    vi.stubEnv('WHATSAPP_ACCOUNTS', '{}');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await dispatchWhatsApp()).toEqual({ processed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
