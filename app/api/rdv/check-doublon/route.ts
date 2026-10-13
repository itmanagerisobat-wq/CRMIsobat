import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raisonSociale = (req.nextUrl.searchParams.get('raison_sociale') || '').trim();
  const operation = (req.nextUrl.searchParams.get('operation') || '').trim();
  const excludeId = req.nextUrl.searchParams.get('exclude_id');

  if (!raisonSociale) return NextResponse.json({ sameCount: 0, sameOperation: null });

  const db = supabaseAdmin();
  let query = db.from('rdv').select('*').ilike('raison_sociale', raisonSociale);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  const sameOperationMatch = operation
    ? rows.find((r) => (r.operation || '').trim().toLowerCase() === operation.trim().toLowerCase())
    : null;

  return NextResponse.json({
    sameCount: rows.length,
    sameOperation: sameOperationMatch || null,
  });
}
