import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getSessionUser(req);
  if (!actor || actor.role === 'agent' || actor.role === 'viewer' || actor.role === 'relanceur' || actor.role === 'responsable_b2c') {
    return NextResponse.json({ error: 'Acces reserve aux gestionnaires' }, { status: 403 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('rdv_requests')
    .update({ status: 'refused', resolved_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'pending');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
