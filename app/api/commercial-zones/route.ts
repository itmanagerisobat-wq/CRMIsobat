import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('commercial_zones').select('*').order('commercial');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json(); // { commercial, region_code }
  if (!body.commercial?.trim() || !body.region_code?.trim()) {
    return NextResponse.json({ error: 'Commercial et region requis' }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('commercial_zones')
    .insert({ commercial: body.commercial.trim(), region_code: body.region_code.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
