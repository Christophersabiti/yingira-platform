import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/server/supabase';
import { appOrigin } from '@/server/config';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const db = await supabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${appOrigin()}/dashboard`);
  }
  return NextResponse.redirect(
    `${appOrigin()}/login?error=Confirmation+link+unavailable.+Please+sign+in+or+request+a+new+link.`,
  );
}
