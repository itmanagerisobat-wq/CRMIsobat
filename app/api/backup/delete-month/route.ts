import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, verifyCurrentUserPassword } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { month, password } = await req.json();
  if (!month) return NextResponse.json({ error: 'Mois requis' }, { status: 400 });

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

  const { error, count } = await db.from('rdv').delete({ count: 'exact' }).eq('month', month);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logActivity(user, 'delete_rdv', `SUPPRESSION du mois "${month}" (${count || 0} RDV)`);

  return NextResponse.json({ ok: true, deleted: count || 0 });
}
