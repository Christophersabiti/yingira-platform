import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { invitationLinks, issueToken } from '../../src/lib/tokens';

describe('event invitation links after an encryption-key change', () => {
  const current = randomBytes(32).toString('base64');
  const previous = randomBytes(32).toString('base64');
  it('recovers existing links with the previous key and keeps new links working', () => {
    const old = issueToken(previous);
    const fresh = issueToken(current);
    expect(
      invitationLinks(
        [
          { id: 'old', token_ciphertext: old.tokenCiphertext },
          { id: 'new', token_ciphertext: fresh.tokenCiphertext },
        ],
        'https://example.test',
        [current, previous],
      ),
    ).toEqual({
      old: `https://example.test/i/${old.token}`,
      new: `https://example.test/i/${fresh.token}`,
    });
  });
  it('isolates unreadable, malformed and revoked invitations without crashing the event', () => {
    const fresh = issueToken(current);
    expect(
      invitationLinks(
        [
          {
            id: 'missing-key',
            token_ciphertext: issueToken(previous).tokenCiphertext,
          },
          { id: 'malformed', token_ciphertext: 'invalid' },
          { id: 'revoked', token_ciphertext: null },
          { id: 'good', token_ciphertext: fresh.tokenCiphertext },
        ],
        'https://example.test',
        [current],
      ),
    ).toEqual({ good: `https://example.test/i/${fresh.token}` });
  });
});
