import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') || 100);
  const rdvId = req.nextUrl.searchParams.get('rdv_id');
  const db = supabaseAdmin();
  let query = db.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (rdvId) query = query.eq('rdv_id', rdvId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}
