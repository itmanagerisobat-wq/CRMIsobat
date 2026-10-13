import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';
import { channelVisibleTo } from '@/lib/chat';
import { scopeOf } from '@/lib/chat-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  try {
    const db = directDb();
    const { rows } = await db.query(
      `select i.mime, i.data, m.channel from chat_images i join chat_messages m on m.image_id = i.id where i.id = $1`, [params.id]);
    if (!rows[0]) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const scope = await scopeOf(me);
    if (me.role !== 'admin' && !channelVisibleTo(rows[0].channel, me.userId, scope)) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }
    return new NextResponse(rows[0].data, { headers: { 'Content-Type': rows[0].mime || 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
