import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const email = z.string().email().max(254).parse(process.argv[2]);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw Error(
    'Select the intended environment with --env-file before provisioning.',
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await client.rpc('yingira_authorize_organization_creator', {
  p_email: email,
});
if (error)
  throw Error('Admin onboarding failed. Check project and migrations.');
console.log(
  `Admin onboarding enabled for ${email} on ${new URL(url).host}. They must register and confirm their email, then create a workspace. No existing organization access was granted.`,
);
