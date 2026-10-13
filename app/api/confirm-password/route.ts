import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyCurrentUserPassword } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const user = await getSessionUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  let dbUser: { password_hash: string } | null = null;
  if (!user.userId.startsWith('legacy-')) {
    const db = supabaseAdmin();
    const { data } = await db.from('users').select('password_hash').eq('id', user.userId).single();
    dbUser = data;
  }

  const ok = await verifyCurrentUserPassword(user, password ?? '', dbUser);
  if (!ok) return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });

  return NextResponse.json({ ok: true });
}
