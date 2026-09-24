import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
import { submitPesapal, verifyPesapal } from '@/server/pesapal';
const id = '10000000-0000-4000-8000-000000000001',
  org = '10000000-0000-4000-8000-000000000002',
  tracking = '10000000-0000-4000-8000-000000000003';
const order = {
  id,
  organization_id: org,
  purpose: 'invoice',
  amount: 50000,
  currency: 'UGX',
  details: { number: 'INV-001' },
  customer_name: 'Test Client',
  customer_email: 'client@yingira.test',
  customer_phone: '',
  tracking_id: tracking,
};
const response = (x: unknown) =>
  new Response(JSON.stringify(x), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  vi.restoreAllMocks();
  mocks.rpc.mockReset();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test');
  vi.stubEnv('APP_ORIGIN', 'https://yingira.test');
  vi.stubEnv(
    'PESAPAL_MERCHANTS',
    JSON.stringify({
      [org]: {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        notificationId: tracking,
        mode: 'sandbox',
      },
    }),
  );
  mocks.rpc.mockImplementation(
    async (_name: string, p: { p_action: string }) => ({
      data:
        p.p_action === 'read'
          ? order
          : p.p_action === 'claim'
            ? { ...order, claimed: true }
            : { status: 'completed' },
      error: null,
    }),
  );
});
describe('Pesapal verification boundary', () => {
  it('credits only a matching server-verified UGX transaction', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response({ token: 'access' }))
      .mockResolvedValueOnce(
        response({
          status: '200',
          merchant_reference: id,
          currency: 'UGX',
          amount: 50000,
          status_code: 1,
          confirmation_code: 'TEST',
        }),
      );
    vi.stubGlobal('fetch', fetch);
    await verifyPesapal(id);
    expect(mocks.rpc).toHaveBeenLastCalledWith('yingira_pesapal_worker', {
      p_action: 'settle',
      p_data: {
        id,
        trackingId: tracking,
        amount: 50000,
        currency: 'UGX',
        status: 'completed',
        confirmation: 'TEST',
        mode: 'sandbox',
      },
    });
    expect(fetch.mock.calls[1][0]).toContain('GetTransactionStatus');
  });
  it('does not credit mismatched amount, reference or currency', async () => {
    for (const override of [
      { amount: 1 },
      { currency: 'USD' },
      { merchant_reference: org },
    ]) {
      mocks.rpc.mockClear();
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof globalThis.fetch>()
          .mockResolvedValueOnce(response({ token: 'access' }))
          .mockResolvedValueOnce(
            response({
              status: '200',
              merchant_reference: id,
              currency: 'UGX',
              amount: 50000,
              status_code: 1,
              ...override,
            }),
          ),
      );
      await expect(verifyPesapal(id)).rejects.toThrow('did not match');
      expect(mocks.rpc.mock.calls.some((c) => c[1].p_action === 'settle')).toBe(
        false,
      );
    }
  });
  it('does not resubmit an uncertain order', async () => {
    mocks.rpc.mockImplementation(
      async (_n: string, p: { p_action: string }) => ({
        data:
          p.p_action === 'read' ? order : { claimed: false, status: 'unknown' },
        error: null,
      }),
    );
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(response({ token: 'access' }));
    vi.stubGlobal('fetch', fetch);
    await expect(submitPesapal(id)).rejects.toThrow('uncertain');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('records uncertainty on lost submit response instead of retrying the charge', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(response({ token: 'access' }))
        .mockRejectedValueOnce(Error('timeout')),
    );
    await expect(submitPesapal(id)).rejects.toThrow('uncertain');
    expect(mocks.rpc).toHaveBeenLastCalledWith('yingira_pesapal_worker', {
      p_action: 'uncertain',
      p_data: { id },
    });
  });
  it('rejects a provider redirect to an unexpected host', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(response({ token: 'access' }))
        .mockResolvedValueOnce(
          response({
            merchant_reference: id,
            order_tracking_id: tracking,
            redirect_url: 'https://attacker.test/pay',
          }),
        ),
    );
    await expect(submitPesapal(id)).rejects.toThrow('uncertain');
    expect(
      mocks.rpc.mock.calls.some((c) => c[1].p_action === 'submitted'),
    ).toBe(false);
  });
});
