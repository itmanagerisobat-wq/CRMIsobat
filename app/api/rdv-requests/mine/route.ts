import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getSessionUser(req);
  const agentId = actor?.userId.startsWith('agentpin-') ? actor.userId.replace('agentpin-', '') : null;
  if (!agentId) return NextResponse.json({ data: [] });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('rdv_requests')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}
