import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

// Deconnecte tous les comptes nominatifs (sauf celui de l'admin qui clique).
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  const { error } = await supabaseAdmin().from('users').update({ sessions_valid_after: new Date().toISOString() }).neq('id', me.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logActivity(me, 'logout_all', 'Tous les comptes deconnectes');
  return NextResponse.json({ ok: true });
}
