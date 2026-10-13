import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('relance_log')
    .select('rdv_id, agent, commentaire, date_prochain_contact')
    .eq('date_prochain_contact', today);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}
