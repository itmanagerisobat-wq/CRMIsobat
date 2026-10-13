import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'pending';

  // Direct Postgres connection when DATABASE_URL is configured -- bypasses
  // Supabase's REST API (PostgREST), which was observed serving stale data
  // for this table (new rows confirmed present via direct SQL never showed
  // up through the REST API, across redeploys and project restarts). Falls
  // back to the REST client if DATABASE_URL isn't set, so nothing breaks
  // if the env var is ever removed.
  let all: any[] = [];
  if (process.env.DATABASE_URL) {
    try {
      const { rows } = await directDb().query('select * from rdv_requests order by created_at desc');
      all = rows;
    } catch (e: any) {
      return NextResponse.json({ error: `Connexion directe a la base echouee: ${e.message}` }, { status: 500 });
    }
  } else {
    const db = supabaseAdmin();
    const { data, error } = await db.from('rdv_requests').select('*').order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    all = data || [];
  }

  // les demandes B2C saisies a la main (flow = 'manual') ont leur propre circuit (/api/b2c-rdv)
  const flowParam = req.nextUrl.searchParams.get('flow');
  let filtered = flowParam === 'all' ? all : all.filter((r) => (r.flow || 'slot') !== 'manual');
  const actor = await getSessionUser(req);
  if (actor?.role === 'viewer' || actor?.role === 'relanceur') filtered = filtered.filter((r) => (r.type_client || 'b2b') === 'b2b');
  if (actor?.role === 'responsable_b2c') filtered = filtered.filter((r) => r.type_client === 'b2c');
  const universParam = req.nextUrl.searchParams.get('univers');
  if (universParam === 'b2b' || universParam === 'b2c') filtered = filtered.filter((r) => (r.type_client || 'b2b') === universParam);
  if (status !== 'all') filtered = filtered.filter((r) => r.status === status);
  if (status === 'pending') filtered = [...filtered].reverse(); // oldest pending first

  return NextResponse.json(
    { data: filtered },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Pragma': 'no-cache' } }
  );
}
