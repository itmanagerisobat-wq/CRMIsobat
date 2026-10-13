import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  const heure = req.nextUrl.searchParams.get('heure');
  const commercial = req.nextUrl.searchParams.get('commercial') || '';
  const raisonSociale = req.nextUrl.searchParams.get('raison_sociale') || '';
  const excludeId = req.nextUrl.searchParams.get('exclude_id');

  if (!date || !heure) return NextResponse.json({ commercialConflict: null, clientConflict: null });

  const db = supabaseAdmin();
  let query = db.from('rdv').select('*').eq('date', date).eq('heure', heure);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  const commercialConflict = commercial
    ? rows.find((r) => (r.commercial || '').trim().toLowerCase() === commercial.trim().toLowerCase())
    : null;
  const clientConflict = raisonSociale
    ? rows.find((r) => (r.raison_sociale || '').trim().toLowerCase() === raisonSociale.trim().toLowerCase())
    : null;

  return NextResponse.json({ commercialConflict: commercialConflict || null, clientConflict: clientConflict || null });
}
