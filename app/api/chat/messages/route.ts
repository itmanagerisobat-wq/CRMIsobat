import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';
import { dmChannel, ROOM_IDS, roomsForScope, scopesCanSee } from '@/lib/chat';
import { scopeOf } from '@/lib/chat-server';

export const dynamic = 'force-dynamic';

const MAX_IMAGE = 3 * 1024 * 1024;
const COLS = 'id, sender_id, sender_name, sender_role, body, image_id, created_at';

// Resout la conversation demandee (salon ou message prive) en verifiant le perimetre.
async function resolveChannel(meId: string, scope: any, withId: string | null, isAdminMe = false): Promise<string | null> {
  const w = withId || 'general';
  if (ROOM_IDS.includes(w)) return roomsForScope(scope).includes(w) ? w : null;
  const { rows } = await directDb().query('select scope, role from chat_presence where user_id = $1', [w]);
  if (!rows[0] || !scopesCanSee(scope, rows[0].scope || 'b2b')) return null;
  // on ne peut pas ecrire a l'admin (il reste invisible dans la liste) ; lui peut ecrire a tout le monde
  if (rows[0].role === 'admin' && !isAdminMe) return null;
  return dmChannel(meId, w);
}

// GET ?with=<userId|general|b2c>&after=<iso>  -- messages (et marque la conversation comme lue)
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  try {
    const scope = await scopeOf(me);
    const channel = await resolveChannel(me.userId, scope, req.nextUrl.searchParams.get('with'), true);
    if (!channel) return NextResponse.json({ data: [], error: 'Conversation non accessible' });
    const after = req.nextUrl.searchParams.get('after');
    const db = directDb();
    const { rows } = after
      ? await db.query(`select ${COLS} from chat_messages where channel = $1 and created_at > $2 order by created_at asc limit 200`, [channel, after])
      : await db.query(`select * from (select ${COLS} from chat_messages where channel = $1 order by created_at desc limit 100) t order by created_at asc`, [channel]);
    await db.query(
      `insert into chat_reads (user_id, channel, last_read_at) values ($1,$2,now())
       on conflict (user_id, channel) do update set last_read_at = now()`, [me.userId, channel]);
    return NextResponse.json({ data: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 200 });
  }
}

// POST multipart : with, body?, image?   (ou JSON { with, body })
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

  let withId: string | null = null; let text = ''; let image: File | null = null;
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    withId = String(form.get('with') || '') || null;
    text = String(form.get('body') || '');
    const f = form.get('image');
    if (f && typeof f !== 'string') image = f as File;
  } else {
    const j = await req.json();
    withId = j.with || null; text = String(j.body || '');
  }
  text = text.trim().slice(0, 2000);
  if (!text && !image) return NextResponse.json({ error: 'Message vide' }, { status: 400 });
  if (image && image.size > MAX_IMAGE) return NextResponse.json({ error: 'Photo trop lourde (max 3 Mo).' }, { status: 400 });
  if (image && !image.type.startsWith('image/')) return NextResponse.json({ error: 'Seules les images sont acceptees.' }, { status: 400 });

  try {
    const scope = await scopeOf(me);
    const channel = await resolveChannel(me.userId, scope, withId, me.role === 'admin');
    if (!channel) return NextResponse.json({ error: 'Conversation non accessible' }, { status: 403 });
    const db = directDb();
    let imageId: string | null = null;
    if (image) {
      const buf = Buffer.from(await image.arrayBuffer());
      imageId = (await db.query('insert into chat_images (mime, data) values ($1,$2) returning id', [image.type, buf])).rows[0].id;
    }
    const { rows } = await db.query(
      `insert into chat_messages (channel, sender_id, sender_name, sender_role, body, image_id)
       values ($1,$2,$3,$4,$5,$6) returning ${COLS}`,
      [channel, me.userId, me.displayName, me.role, text, imageId]);
    return NextResponse.json({ data: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: `Envoi impossible : ${e.message}` }, { status: 500 });
  }
}
