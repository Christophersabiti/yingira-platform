import { NextResponse, type NextRequest } from 'next/server';
import { commandSchema } from '@/lib/contracts';
import { issueToken } from '@/lib/tokens';
import { appOrigin, encryptionKey } from '@/server/config';
import { supabase } from '@/server/supabase';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== appOrigin())
    return NextResponse.json(
      { ok: false, code: 'FORBIDDEN', message: 'This request is not allowed.' },
      { status: 403 },
    );
  if (Number(request.headers.get('content-length') ?? 0) > 16384)
    return NextResponse.json(
      { ok: false, code: 'INVALID_INPUT', message: 'Request too large.' },
      { status: 413 },
    );
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 16384) throw new Error();
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, code: 'INVALID_INPUT', message: 'Invalid request.' },
      { status: 400 },
    );
  }
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        ok: false,
        code: 'INVALID_INPUT',
        message: parsed.error.issues[0]?.message ?? 'Check your fields.',
      },
      { status: 422 },
    );
  const db = await supabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user)
    return NextResponse.json(
      { ok: false, code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
      { status: 401 },
    );
  const { action, ...payload } = parsed.data;
  let data: Record<string, unknown> = { ...payload };
  if (action === 'create_guest' || action === 'reissue') {
    const generated = issueToken(encryptionKey());
    data = {
      ...data,
      tokenHash: generated.tokenHash,
      tokenCiphertext: generated.tokenCiphertext,
    };
  }
  const result = await db.rpc('yingira_command', {
    p_action: action,
    p_data: data,
  });
  if (result.error) {
    const forbidden = result.error.code === '42501';
    return NextResponse.json(
      {
        ok: false,
        code: forbidden ? 'FORBIDDEN' : 'REQUEST_FAILED',
        message: forbidden
          ? 'You do not have access to this action.'
          : 'The action could not be completed. Refresh and check your details.',
      },
      { status: forbidden ? 403 : 400 },
    );
  }
  return NextResponse.json(result.data);
}
