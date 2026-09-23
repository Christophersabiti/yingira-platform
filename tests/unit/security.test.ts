import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  issueToken,
  openToken,
  sealToken,
  tokenDigest,
} from '../../src/lib/tokens';
import { commandSchema, parseQr } from '../../src/lib/contracts';
describe('invitation credentials', () => {
  const key = randomBytes(32).toString('base64');
  it('uses 32 random bytes with no guest details and unique digests', () => {
    const tokens = Array.from({ length: 100 }, () => issueToken(key));
    expect(new Set(tokens.map((t) => t.tokenHash)).size).toBe(100);
    for (const token of tokens) {
      expect(token.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token.token, 'base64url')).toHaveLength(32);
      expect(openToken(token.tokenCiphertext, key)).toBe(token.token);
      expect(token.tokenCiphertext).not.toContain(token.token);
    }
  });
  it('rejects tampered ciphertext and wrong keys', () => {
    const value = issueToken(key);
    expect(() =>
      openToken(value.tokenCiphertext, randomBytes(32).toString('base64')),
    ).toThrow();
    const parts = value.tokenCiphertext.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => openToken(parts.join('.'), key)).toThrow();
  });
  it('does not reuse encryption nonces', () => {
    expect(sealToken('token', key)).not.toBe(sealToken('token', key));
    expect(tokenDigest('abc')).toHaveLength(64);
  });
  it('only accepts invitation URLs on the configured origin', () => {
    const t = issueToken(key).token;
    expect(parseQr(`https://yingira.test/i/${t}`, 'https://yingira.test')).toBe(
      t,
    );
    for (const value of [
      `https://evil.test/i/${t}`,
      `https://yingira.test/i/${t}?other=1`,
      `https://yingira.test/i/${t}#x`,
      `https://yingira.test/other/${t}`,
      'javascript:alert(1)',
    ])
      expect(parseQr(value, 'https://yingira.test')).toBeNull();
  });
});
describe('server request validation', () => {
  const base = {
    action: 'admit',
    eventId: crypto.randomUUID(),
    gateId: crypto.randomUUID(),
    token: randomBytes(32).toString('base64url'),
    quantity: 1,
    expectedVersion: 0,
    idempotencyKey: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
  };
  it.each([0, -1, 1.2, 101, NaN])('rejects invalid quantity %s', (quantity) => {
    expect(commandSchema.safeParse({ ...base, quantity }).success).toBe(false);
  });
  it('requires stable idempotency and version fields', () => {
    expect(commandSchema.safeParse(base).success).toBe(true);
    expect(
      commandSchema.safeParse({ ...base, idempotencyKey: undefined }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({ ...base, expectedVersion: -1 }).success,
    ).toBe(false);
  });
});
