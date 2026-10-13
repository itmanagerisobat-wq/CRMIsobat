import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';
import { isRappelStatut } from '@/lib/relance-statut';
import { logStatusChange } from '@/lib/status-history';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

// body : { statut_relance, commentaire?, date_rappel? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const statut: string | null = body.statut_relance || null;
  const commentaire: string = (body.commentaire || '').trim();
  const dateRappel: string | null = body.date_rappel || null;
  const actor = await getSessionUser(req);

  if (isRappelStatut(statut) && !dateRappel) {
    return NextResponse.json({ error: 'Une date de prochain rappel est obligatoire pour ce statut.' }, { status: 400 });
  }
  const rappelDate = isRappelStatut(statut) ? dateRappel : null;

  try {
    let before: any; let data: any;
    if (process.env.DATABASE_URL) {
      const db = directDb();
      before = (await db.query('select statut_relance from rdv where id = $1', [params.id])).rows[0];
      data = (await db.query(
        `update rdv set statut_relance = $1, relance_commentaire = $2, relance_date_rappel = $3 where id = $4 returning *`,
        [statut, commentaire || null, rappelDate, params.id]
      )).rows[0];
      if (commentaire || rappelDate) {
        await db.query(
          'insert into relance_log (rdv_id, agent, commentaire, date_prochain_contact) values ($1,$2,$3,$4)',
          [params.id, actor?.displayName || null, commentaire || `Statut : ${statut || '—'}`, rappelDate]
        );
      }
    } else {
      const db = supabaseAdmin();
      before = (await db.from('rdv').select('statut_relance').eq('id', params.id).single()).data;
      const r = await db.from('rdv')
        .update({ statut_relance: statut, relance_commentaire: commentaire || null, relance_date_rappel: rappelDate })
        .eq('id', params.id).select().single();
      if (r.error) throw new Error(r.error.message);
      data = r.data;
      if (commentaire || rappelDate) {
        await db.from('relance_log').insert({
          rdv_id: params.id, agent: actor?.displayName || null,
          commentaire: commentaire || `Statut : ${statut || '—'}`, date_prochain_contact: rappelDate,
        });
      }
    }
    await logStatusChange({
      entity_type: 'rdv', entity_id: params.id, field: 'statut_relance',
      old_value: before?.statut_relance, new_value: statut,
      comment: commentaire || (rappelDate ? `Prochain rappel : ${rappelDate}` : null),
      user: actor?.displayName,
    });
    logActivity(actor, 'update_relance', `${data?.raison_sociale || data?.client || ''} -> ${statut || '—'}`, params.id);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
