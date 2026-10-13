import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('commercial_base').select('*').order('commercial');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  const body = await req.json(); // { commercial, code_postal }
  if (!body.commercial?.trim() || !body.code_postal?.trim()) {
    return NextResponse.json({ error: 'Commercial et code postal requis' }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { error } = await db
    .from('commercial_base')
    .upsert({ commercial: body.commercial.trim(), code_postal: body.code_postal.trim(), updated_at: new Date().toISOString() }, { onConflict: 'commercial' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
