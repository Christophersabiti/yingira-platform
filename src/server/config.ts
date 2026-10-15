import 'server-only';
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return { url, key };
}
export function encryptionKey() {
  const key = process.env.INVITATION_ENCRYPTION_KEY;
  if (!key) throw new Error('Invitation encryption is not configured');
  return key;
}
export function appOrigin() {
  return new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000').origin;
}
export function isAllowedOrigin(request: Request) {
  // Fetch Metadata is browser-controlled: page scripts cannot forge Sec-* headers.
  // This supports same-origin requests on deployment aliases without trusting Host
  // or forwarded headers. Older clients must still match the configured origin.
  return (
    request.headers.get('sec-fetch-site') === 'same-origin' ||
    request.headers.get('origin') === appOrigin()
  );
}
