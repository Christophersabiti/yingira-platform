import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
export function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function key(raw: string) {
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32)
    throw new Error('Invitation encryption key must be 32 bytes');
  return decoded;
}
export function sealToken(token: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}
export function openToken(value: string, secret: string) {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted)
    throw new Error('Invalid token envelope');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(secret),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
export function issueToken(secret: string) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: tokenDigest(token),
    tokenCiphertext: sealToken(token, secret),
  };
}

// Historical invitations can outlive the key used to create their envelope.
// Never let an unreadable envelope prevent access to the rest of an event.
export function invitationLinks(
  guests: { id: string; token_ciphertext: string | null }[],
  origin: string,
  secrets: string[],
) {
  const links: Record<string, string> = {};
  for (const guest of guests) {
    if (!guest.token_ciphertext) continue;
    for (const secret of secrets) {
      try {
        const token = openToken(guest.token_ciphertext, secret);
        links[guest.id] = `${origin}/i/${token}`;
        break;
      } catch {
        // Try the retained previous key, then leave recovery to the Admin.
      }
    }
  }
  return links;
}
