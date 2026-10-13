import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';
import { logStatusChange } from '@/lib/status-history';

export const dynamic = 'force-dynamic';

const CAN_WRITE = ['admin', 'gestionnaire', 'responsable_b2c'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me || !CAN_WRITE.includes(me.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  const b = await req.json();
  try {
    const db = directDb();
    const cur = (await db.query('select * from b2c_installations where id = $1', [params.id])).rows[0];
    if (!cur) return NextResponse.json({ error: 'Installation introuvable' }, { status: 404 });
    const patch: Record<string, any> = {};
    for (const k of ['client', 'telephone', 'adresse', 'date_installation', 'statut', 'commentaire']) if (k in b) patch[k] = b[k] || null;
    if ('client' in patch && !patch.client) return NextResponse.json({ error: 'Le nom du client est obligatoire.' }, { status: 400 });
    const keys = Object.keys(patch);
    if (keys.length) {
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const values = keys.map((k) => patch[k]);
      values.push(params.id);
      await db.query(`update b2c_installations set ${sets.join(', ')}, updated_at = now() where id = $${values.length}`, values);
    }
    if ('statut' in patch) {
      await logStatusChange({ entity_type: 'b2c', entity_id: params.id, field: 'installation_statut', old_value: cur.statut, new_value: patch.statut, comment: b.statut_commentaire || null, user: me.displayName });
    }
    const { rows } = await db.query('select * from b2c_installations where id = $1', [params.id]);
    return NextResponse.json({ data: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me || !CAN_WRITE.includes(me.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    await directDb().query('delete from b2c_installations where id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
