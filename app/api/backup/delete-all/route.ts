import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, verifyCurrentUserPassword } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const user = await getSessionUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  const db = supabaseAdmin();

  let dbUser: { password_hash: string } | null = null;
  if (!user.userId.startsWith('legacy-')) {
    const { data } = await db.from('users').select('password_hash').eq('id', user.userId).single();
    dbUser = data;
  }
  const ok = await verifyCurrentUserPassword(user, password ?? '', dbUser);
  if (!ok) return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });

  await db.from('rdv').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('relance_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('import_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  logActivity(user, 'delete_rdv', 'SUPPRESSION TOTALE de toutes les donnees (RDV, clients, relances, imports)');

  return NextResponse.json({ ok: true });
}
