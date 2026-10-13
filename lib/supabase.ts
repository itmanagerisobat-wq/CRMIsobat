import { createClient } from '@supabase/supabase-js';

// Server-side client using the service role key. This file must NEVER be
// imported from a 'use client' component -- the service key bypasses row
// level security and must stay on the server only.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Add them in your Vercel project settings.'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
