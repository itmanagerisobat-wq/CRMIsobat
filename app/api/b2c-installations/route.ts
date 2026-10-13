import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CAN_WRITE = ['admin', 'gestionnaire', 'responsable_b2c'];

export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !CAN_WRITE.includes(me.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    const { rows } = await directDb().query('select * from b2c_installations order by date_installation asc nulls last, created_at desc');
    return NextResponse.json({ data: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message });
  }
}

export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || !CAN_WRITE.includes(me.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  const b = await req.json();
  if (!String(b.client || '').trim()) return NextResponse.json({ error: 'Le nom du client est obligatoire.' }, { status: 400 });
  try {
    const { rows } = await directDb().query(
      `insert into b2c_installations (client, telephone, adresse, date_installation, statut, commentaire, created_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [String(b.client).trim(), b.telephone || null, b.adresse || null, b.date_installation || null, b.statut || null, b.commentaire || null, me.displayName]
    );
    return NextResponse.json({ data: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: `Enregistrement impossible : ${e.message}` }, { status: 500 });
  }
}
