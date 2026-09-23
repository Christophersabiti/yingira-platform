import { AuthPage } from '@/components/auth-page';
import { isConfigured } from '@/server/config';
import { redirect } from 'next/navigation';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!isConfigured()) redirect('/setup');
  return <AuthPage {...await searchParams} />;
}
