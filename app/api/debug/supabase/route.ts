import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: 'Missing env vars', url: !!url, key: !!key }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Raw SQL — what tables exist in public schema?
  const { data: tables, error: tablesError } = await supabase
    .rpc('pg_catalog_tables')
    .select('*')
    .limit(1)
    .maybeSingle()
    .then(() => ({ data: null, error: null })) // rpc won't work, use sql below
    .catch(() => ({ data: null, error: 'rpc failed' }));

  // 2. Try a direct select on users
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  // 3. Try a direct select on plans
  const { data: plansData, error: plansError } = await supabase
    .from('plans')
    .select('id')
    .limit(1);

  // 4. Check env var values (prefix only for security)
  return NextResponse.json({
    env: {
      url: url.slice(0, 30) + '…',
      keyPrefix: key.slice(0, 20) + '…',
    },
    users: { data: usersData, error: usersError },
    plans: { data: plansData, error: plansError },
  });
}
