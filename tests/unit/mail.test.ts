import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));
import { processMail, trackMail } from '../../src/server/mail';
import { issueToken } from '../../src/lib/tokens';
const key = Buffer.alloc(32, 7).toString('base64');
beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_FROM', 'Yingira <test@example.test>');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'local-test-only');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:56321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-public');
  vi.stubEnv('INVITATION_ENCRYPTION_KEY', key);
  vi.stubEnv('APP_ORIGIN', 'https://example.test');
  rpc.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('transactional email adapter', () => {
  it('does not send without verified-sender configuration', async () => {
    vi.stubEnv('EMAIL_FROM', '');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(processMail()).rejects.toThrow('not connected');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('persists a frozen payload before sending and records acceptance separately from delivery', async () => {
    const generated = issueToken(key);
    let claimed = false;
    const saved: Record<string, unknown>[] = [];
    rpc.mockImplementation(
      async (
        _name: string,
        args: { p_action: string; p_data: Record<string, unknown> },
      ) => {
        saved.push(args.p_data);
        if (args.p_action === 'claim') {
          if (claimed) return { data: null };
          claimed = true;
          return {
            data: {
              id: 'message-1',
              recipient: 'guest@example.test',
              name: 'Guest',
              ciphertext: generated.tokenCiphertext,
              title: 'Wedding',
              venue: 'Hall',
              startsAt: '2027-01-01T10:00:00Z',
              timezone: 'Africa/Kampala',
              subject: 'You are invited',
              message: 'Please join us',
              payload: null,
            },
          };
        }
        return { data: { ok: true } };
      },
    );
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 'provider-1' }),
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await processMail('event-1')).toEqual({ processed: 1 });
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect((options.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'yingira-message-1',
    );
    expect(JSON.parse(String(options.body)).text).toContain(generated.token);
    expect(saved.some((d) => d.payload)).toBe(true);
    expect(saved.some((d) => d.status === 'accepted')).toBe(true);
    expect(saved.some((d) => d.status === 'delivered')).toBe(false);
  });
  it('retains an uncertain request for recovery without changing its provider payload', async () => {
    const payload = {
      from: 'host@example.test',
      to: ['guest@example.test'],
      subject: 'Original',
      text: 'Frozen content',
    };
    rpc.mockResolvedValue({ data: { id: 'message-2', payload } });
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw Error('timeout');
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await processMail('event-1')).toEqual({ processed: 0 });
    expect(
      JSON.parse(String((fetcher.mock.calls[0][1] as RequestInit).body)),
    ).toEqual(payload);
    expect(rpc.mock.calls.some(([, a]) => a.p_action === 'complete')).toBe(
      false,
    );
  });
  it('uses provider evidence when tracking a bounce', async () => {
    rpc.mockImplementation(async (_n: string, a: { p_action: string }) => ({
      data:
        a.p_action === 'track'
          ? [{ id: 'message-3', providerId: 'provider-3' }]
          : { ok: true },
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => Response.json({ last_event: 'bounced' })),
    );
    await trackMail('event-1');
    expect(rpc).toHaveBeenCalledWith('yingira_mail_worker', {
      p_action: 'complete',
      p_data: { id: 'message-3', status: 'bounced' },
    });
  });
});
