import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('rdv_requests').select('agent_name, status');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary: Record<string, { pending: number; validated: number; refused: number }> = {};
  for (const r of data || []) {
    const name = r.agent_name || 'Inconnu';
    if (!summary[name]) summary[name] = { pending: 0, validated: 0, refused: 0 };
    if (r.status === 'pending') summary[name].pending++;
    else if (r.status === 'validated') summary[name].validated++;
    else if (r.status === 'refused') summary[name].refused++;
  }

  return NextResponse.json({ data: summary }, { headers: { 'Cache-Control': 'no-store' } });
}
