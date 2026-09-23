'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { supabase } from '@/server/supabase';
import { appOrigin } from '@/server/config';
const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
});
export async function signIn(form: FormData) {
  const value = z
    .object({ email: z.string().email(), password: z.string().min(1).max(128) })
    .safeParse(Object.fromEntries(form));
  if (!value.success) redirect('/login?error=Check+your+email+and+password');
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword(value.data);
  if (error)
    redirect(
      '/login?error=Unable+to+sign+in.+Check+your+details+and+email+confirmation.',
    );
  redirect('/dashboard');
}
export async function signUp(form: FormData) {
  const value = credentials.safeParse(Object.fromEntries(form));
  if (!value.success)
    redirect(
      '/register?error=Use+a+valid+email+and+a+password+of+at+least+12+characters',
    );
  const db = await supabase();
  const { error } = await db.auth.signUp({
    ...value.data,
    options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
  });
  if (error)
    redirect('/register?error=Unable+to+create+account.+Please+try+again.');
  redirect(
    '/login?message=Check+your+email+to+confirm+your+account,+then+sign+in.',
  );
}
export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  redirect('/login');
}
