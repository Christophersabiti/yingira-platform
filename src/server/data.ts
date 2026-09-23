import 'server-only';
import { redirect } from 'next/navigation';
import { supabase } from './supabase';
import { isConfigured } from './config';
export async function authenticated() {
  if (!isConfigured()) redirect('/setup');
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) redirect('/login');
  return { db, user: data.user };
}
export async function query<T>(
  action: string,
  data: Record<string, unknown> = {},
) {
  const { db } = await authenticated();
  const result = await db.rpc('yingira_command', {
    p_action: action,
    p_data: data,
  });
  if (result.error)
    throw new Error(
      'Could not load your event workspace. Check your connection and try again.',
    );
  return result.data as T;
}
