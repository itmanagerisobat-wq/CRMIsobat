import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Vue admin (lecture seule, aucune trace cote utilisateurs : ne marque rien comme lu).
// Sans ?channel= : liste des conversations. Avec ?channel= : tous les messages.
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Reserve a l\'administrateur' }, { status: 403 });
  const channel = req.nextUrl.searchParams.get('channel');
  try {
    const db = directDb();
    if (channel) {
      const { rows } = await db.query(
        `select id, sender_id, sender_name, sender_role, body, image_id, created_at
         from chat_messages where channel = $1 order by created_at asc limit 1000`, [channel]);
      return NextResponse.json({ data: rows }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const convs = (await db.query(
      `select channel, count(*)::int as n, max(created_at) as last_at from chat_messages group by channel order by max(created_at) desc`)).rows;
    const names = new Map<string, string>();
    (await db.query('select user_id, name from chat_presence')).rows.forEach((r: any) => names.set(r.user_id, r.name));
    const rooms = new Map<string, string>();
    (await db.query('select id, name from chat_rooms')).rows.forEach((r: any) => rooms.set(r.id, r.name));
    const data = convs.map((c: any) => {
      if (c.channel.startsWith('dm:')) {
        const [a, b] = c.channel.slice(3).split('|');
        return { ...c, kind: 'dm', title: `${names.get(a) || a} ↔ ${names.get(b) || b}` };
      }
      return { ...c, kind: 'room', title: rooms.get(c.channel) || c.channel };
    });
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message });
  }
}
