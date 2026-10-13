import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month');
  const db = supabaseAdmin();
  let query = db.from('objectifs').select('*');
  if (month) query = query.eq('month', month);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  const body = await req.json(); // { commercial, month, target_rdv }
  const db = supabaseAdmin();
  const { error } = await db
    .from('objectifs')
    .upsert(
      { commercial: body.commercial, month: body.month, target_rdv: body.target_rdv },
      { onConflict: 'commercial,month' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
