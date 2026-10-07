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

import {
  guestUrlsCsv,
  guestUrlsText,
  shareSlugPattern,
} from '../../src/lib/invitation-links';
describe('guest URL sharing', () => {
  it('accepts bounded readable aliases and rejects bare names and route traversal', () => {
    expect(shareSlugPattern.test('florence-nabukenya-AbCdEf0123456789')).toBe(
      true,
    );
    for (const slug of [
      'florence',
      '../dashboard',
      'florence-short',
      `${'a'.repeat(25)}-AbCdEf0123456789`,
    ])
      expect(shareSlugPattern.test(slug)).toBe(false);
  });
  it('exports names alongside URLs, escaping CSV and spreadsheet formulas', () => {
    const rows = [
      {
        id: '1',
        name: 'Florence, family',
        url: 'https://example.test/florence-AbCdEf0123456789',
      },
      {
        id: '2',
        name: '=SUM(1)',
        url: 'https://example.test/guest-AbCdEf0123456789',
      },
    ];
    expect(guestUrlsCsv(rows)).toContain('"Guest name","Invitation URL"');
    expect(guestUrlsCsv(rows)).toContain('"Florence, family"');
    expect(guestUrlsCsv(rows)).toContain('"\'=SUM(1)"');
    expect(guestUrlsText(rows)).toContain('Florence, family\thttps://');
  });
});
