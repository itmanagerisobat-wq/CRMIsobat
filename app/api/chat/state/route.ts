import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';
import { roomsForScope, scopesCanSee } from '@/lib/chat';
import { scopeOf } from '@/lib/chat-server';

export const dynamic = 'force-dynamic';

// Heartbeat + salons + personnes visibles + messages non lus par conversation.
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  try {
    const db = directDb();
    const scope = await scopeOf(me);
    await db.query(
      `insert into chat_presence (user_id, name, role, scope) values ($1,$2,$3,$4)
       on conflict (user_id) do update set name = excluded.name, role = excluded.role, scope = excluded.scope, last_seen = now()`,
      [me.userId, me.displayName, me.role, scope]
    );
    const roomIds = roomsForScope(scope);
    const rooms = (await db.query('select id, name from chat_rooms where id = any($1) order by id', [roomIds])).rows;
    const all = (await db.query(
      `select user_id, name, role, scope, (last_seen > now() - interval '45 seconds') as online
       from chat_presence where user_id <> $1 order by online desc, name`, [me.userId])).rows;
    // vrais comptes (noms reels) : fusionnes avec la presence ; les connexions "mot de passe commun" generiques sont masquees
    let accounts: any[] = [];
    try { accounts = (await db.query('select id, display_name, role from users')).rows; } catch {}
    const byId = new Map<string, any>(accounts.map((a: any) => [String(a.id), a]));
    const presById = new Map<string, any>(all.map((u: any) => [String(u.user_id), u]));
    const merged: any[] = [];
    for (const u of all) {
      if (String(u.user_id).startsWith('legacy-')) continue;
      const acc = byId.get(String(u.user_id));
      merged.push(acc ? { ...u, name: acc.display_name, role: acc.role } : u);
    }
    for (const a of accounts) {
      if (String(a.id) === String(me.userId) || presById.has(String(a.id))) continue;
      const sc = a.role === 'admin' || a.role === 'gestionnaire' ? 'all' : a.role === 'responsable_b2c' ? 'b2c' : 'b2b';
      merged.push({ user_id: String(a.id), name: a.display_name, role: a.role, scope: sc, online: false });
    }
    merged.sort((x: any, y: any) => (Number(!!y.online) - Number(!!x.online)) || String(x.name).localeCompare(String(y.name)));
    let users = merged.filter((u: any) => scopesCanSee(scope, (u.scope || 'b2b')));
    if (me.role !== 'admin') {
      // l'admin n'apparait pas dans la liste, sauf s'il a deja ecrit a cette personne
      const talked = (await db.query(
        `select distinct channel from chat_messages where channel like 'dm:%' and sender_role = 'admin'
           and $1 = any(string_to_array(substr(channel, 4), '|'))`, [me.userId])).rows.map((r: any) => r.channel);
      users = users.filter((u: any) => u.role !== 'admin' || talked.includes('dm:' + [me.userId, u.user_id].sort().join('|')));
    }
    const unreadRows = (await db.query(
      `select m.channel, count(*)::int as n
       from chat_messages m
       join chat_presence p on p.user_id = $1
       left join chat_reads r on r.user_id = $1 and r.channel = m.channel
       where m.sender_id <> $1
         and (m.channel = any($2) or (m.channel like 'dm:%' and $1 = any(string_to_array(substr(m.channel, 4), '|'))))
         and m.created_at > coalesce(r.last_read_at, p.first_seen)
       group by m.channel`, [me.userId, roomIds])).rows;
    const unread: Record<string, number> = {};
    unreadRows.forEach((r: any) => { unread[r.channel] = r.n; });
    return NextResponse.json({ me: { id: me.userId, name: me.displayName, role: me.role }, scope, rooms, users, unread }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, rooms: [], users: [], unread: {} }, { status: 200 });
  }
}
