import { AuthPage } from '@/components/auth-page';
import { isConfigured } from '@/server/config';
import { redirect } from 'next/navigation';
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isConfigured()) redirect('/setup');
  return <AuthPage register {...await searchParams} />;
}
