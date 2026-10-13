import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const operation = req.nextUrl.searchParams.get('operation');
  const db = supabaseAdmin();
  let query = db.from('qualite_criteres_ref').select('*').order('created_at');
  if (operation) query = query.eq('operation', operation);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json(); // { operation, critere }
  if (!body.operation?.trim() || !body.critere?.trim()) {
    return NextResponse.json({ error: 'Operation et critere requis' }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('qualite_criteres_ref')
    .insert({ operation: body.operation.trim(), critere: body.critere.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
