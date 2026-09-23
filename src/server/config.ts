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
