import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';
import { ROOM_IDS } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// PATCH { id: 'general'|'b2c', name } -- renommer un salon (admin uniquement)
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Reserve a l\'administrateur' }, { status: 403 });
  const { id, name } = await req.json();
  const clean = String(name || '').trim().slice(0, 40);
  if (!ROOM_IDS.includes(id) || !clean) return NextResponse.json({ error: 'Nom invalide' }, { status: 400 });
  try {
    await directDb().query(
      'insert into chat_rooms (id, name) values ($1,$2) on conflict (id) do update set name = excluded.name', [id, clean]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
