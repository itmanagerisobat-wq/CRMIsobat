import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const rdvId = req.nextUrl.searchParams.get('rdv_id');
  if (!rdvId) return NextResponse.json({ error: 'rdv_id requis' }, { status: 400 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('relance_log')
    .select('*')
    .eq('rdv_id', rdvId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json(); // { rdv_id, agent, commentaire, date_prochain_contact }
  if (!body.rdv_id || !body.commentaire) {
    return NextResponse.json({ error: 'rdv_id et commentaire requis' }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('relance_log')
    .insert({
      rdv_id: body.rdv_id,
      agent: body.agent || null,
      commentaire: body.commentaire,
      date_prochain_contact: body.date_prochain_contact || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
