import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('parametres').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const out: Record<string, string[]> = {};
  for (const row of data ?? []) out[row.key] = row.values ?? [];
  return NextResponse.json({ data: out }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json(); // { key: 'operations', values: [...] }
  const db = supabaseAdmin();
  const { error } = await db
    .from('parametres')
    .upsert({ key: body.key, values: body.values }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
