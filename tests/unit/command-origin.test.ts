import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
const { getUser, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/server/supabase', () => ({
  supabase: async () => ({ auth: { getUser }, rpc }),
}));
import { POST } from '@/app/api/command/route';
import { requireOrigin } from '@/server/planning';

const deployment = 'https://yingira-preview.example';
function request(origin: string | null, site?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin !== null) headers.set('origin', origin);
  if (site) headers.set('sec-fetch-site', site);
  return new NextRequest(`${deployment}/api/command`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'start_shift',
      eventId: '11111111-1111-4111-8111-111111111111',
      leaseId: '22222222-2222-4222-8222-222222222222',
      role: 'usher',
    }),
  });
}
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://yingira.example');
  getUser
    .mockReset()
    .mockResolvedValue({ data: { user: { id: 'staff' } }, error: null });
  rpc
    .mockReset()
    .mockResolvedValue({
      data: { ok: true, data: { role: 'usher' } },
      error: null,
    });
});
afterEach(() => vi.unstubAllEnvs());

describe('usher shift request origin', () => {
  it.each(['usher', 'admin'])(
    'allows same-origin deployment requests for %s',
    async (user) => {
      getUser.mockResolvedValue({ data: { user: { id: user } }, error: null });
      const response = await POST(request(deployment, 'same-origin'));
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('yingira_command', {
        p_action: 'start_shift',
        p_data: expect.objectContaining({ role: 'usher' }),
      });
    },
  );
  it('allows the configured origin for browsers without Fetch Metadata', async () => {
    expect((await POST(request('https://yingira.example'))).status).toBe(200);
  });
  it.each([
    ['https://evil.example', 'cross-site'],
    ['https://other.yingira.example', 'same-site'],
    [deployment, undefined],
    [null, undefined],
    ['null', undefined],
  ])('rejects untrusted origin %s with metadata %s', async (origin, site) => {
    expect((await POST(request(origin, site))).status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('still requires authentication for same-origin requests', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request(deployment, 'same-origin'))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('still enforces database permissions for same-origin requests', async () => {
    rpc.mockResolvedValue({ error: { code: '42501' } });
    const response = await POST(request(deployment, 'same-origin'));
    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe(
      'You do not have access to this action.',
    );
  });
  it('uses the same protection for planning requests', () => {
    expect(() =>
      requireOrigin(request(deployment, 'same-origin')),
    ).not.toThrow();
    expect(() =>
      requireOrigin(request('https://evil.example', 'cross-site')),
    ).toThrow('Request not allowed.');
  });
});
