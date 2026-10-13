import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { logStatusChange } from '@/lib/status-history';
import { extractDeptCode } from '@/lib/departement-cp';
import { buildMonthLabel } from '@/lib/months';
import { weekNumberForDate } from '@/lib/weeks';
import { isConfirme, isReporteConf, isAnnuleConf, isChangementAvis, cleanFiche, deptFromCp } from '@/lib/b2c-flow';

export const dynamic = 'force-dynamic';

function monthAndWeek(date: string) {
  const [year, monthNum] = date.split('-').map((n) => parseInt(n, 10));
  const month = buildMonthLabel(year, monthNum);
  return { month, week_number: weekNumberForDate(month, date) };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me || me.role === 'viewer' || me.role === 'relanceur') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  const b = await req.json();
  const db = directDb();
  try {
    const cur = (await db.query(`select * from rdv_requests where id = $1 and flow = 'manual'`, [params.id])).rows[0];
    if (!cur) return NextResponse.json({ error: 'RDV introuvable' }, { status: 404 });

    const isAgent = me.role === 'agent';
    if (isAgent) {
      const agentId = me.userId.startsWith('agentpin-') ? me.userId.replace('agentpin-', '') : null;
      if (cur.agent_id !== agentId) return NextResponse.json({ error: 'Ce RDV ne t\'appartient pas.' }, { status: 403 });
    }

    // champs modifiables (l'agent : fiche + date/heure ; la responsable : tout)
    const patch: Record<string, any> = {};
    for (const k of ['client', 'telephone', 'adresse', 'date', 'heure', 'code_postal']) if (k in b) patch[k] = b[k] || null;
    if ('code_postal' in b) patch.departement = deptFromCp(b.code_postal);
    if ('fiche' in b) {
      const fiche = cleanFiche(b.fiche);
      patch.fiche = JSON.stringify(fiche);
      patch.operation = fiche.preconisation || null;
    }
    if (!isAgent) {
      if ('commercial' in b) patch.commercial = b.commercial || null;
      if ('confirmation_commentaire' in b) patch.confirmation_commentaire = b.confirmation_commentaire || null;
      for (const k of ['relance_statut', 'relance_commentaire', 'relance_date_rappel']) if (k in b) patch[k] = b[k] || null;
    }

    // etape 1 -> 2 : la responsable valide le RDV (date + heure fixees) -> il passe dans "Confirmation"
    const merged0 = { ...cur, ...patch };
    if (!isAgent && b.action === 'valider') {
      if (!merged0.date || !merged0.heure) return NextResponse.json({ error: 'Valide d\'abord : renseigne la date et l\'heure du RDV.' }, { status: 400 });
      patch.valide_at = new Date().toISOString();
      patch.confirmation_statut = 'A confirmer';
      await logStatusChange({ entity_type: 'b2c', entity_id: params.id, field: 'validation', old_value: 'Envoye', new_value: 'Valide (a confirmer)', comment: b.confirmation_commentaire || null, user: me.displayName });
    }
    if (!isAgent && 'confirmation_statut' in b && !cur.valide_at && !patch.valide_at) {
      return NextResponse.json({ error: 'Valide d\'abord le RDV (onglet RDV envoyes par les agents).' }, { status: 400 });
    }

    // changement de statut de confirmation (responsable / admin / gestionnaire)
    const newStatut: string | undefined = !isAgent && 'confirmation_statut' in b ? b.confirmation_statut : undefined;
    const merged = { ...cur, ...patch };
    let planningRdvId: string | null = cur.rdv_id || null;

    if (newStatut !== undefined && newStatut !== cur.confirmation_statut) {
      patch.confirmation_statut = newStatut;
      if (isConfirme(newStatut)) {
        if (!merged.date || !merged.heure) return NextResponse.json({ error: 'Confirmation impossible : renseigne la date et l\'heure du RDV.' }, { status: 400 });
        if (!merged.commercial) return NextResponse.json({ error: 'Confirmation impossible : affecte un commercial.' }, { status: 400 });
        patch.status = 'validated';
        patch.resolved_at = new Date().toISOString();
      } else if (isAnnuleConf(newStatut)) {
        patch.status = 'cancelled'; patch.resolved_at = new Date().toISOString();
      } else if (isChangementAvis(newStatut)) {
        patch.status = 'refused'; patch.resolved_at = new Date().toISOString();
      } else {
        patch.status = 'pending'; patch.resolved_at = null;
      }
      if (isReporteConf(newStatut) && (!b.date || b.date === cur.date)) {
        return NextResponse.json({ error: 'Reporte : indique la nouvelle date du RDV.' }, { status: 400 });
      }
    }

    // ---- applique sur rdv_requests
    const keys = Object.keys(patch);
    if (keys.length > 0) {
      const sets = keys.map((k, i) => `${k} = $${i + 1}${k === 'fiche' ? '::jsonb' : ''}`);
      const values = keys.map((k) => patch[k]);
      values.push(params.id);
      sets.push('updated_at = now()');
      await db.query(`update rdv_requests set ${sets.join(', ')} where id = $${values.length}`, values);
    }

    // ---- synchronisation avec le Planning (table rdv)
    const sb = supabaseAdmin();
    const statutNow = newStatut !== undefined ? newStatut : cur.confirmation_statut;
    const after = { ...merged, ...patch };
    let deptLabel: string | null = null;
    if (after.departement) {
      const { data: dp } = await sb.from('parametres').select('values').eq('key', 'departements').maybeSingle();
      deptLabel = (dp?.values || []).find((l: string) => extractDeptCode(l) === String(after.departement)) || null;
    }
    if (statutNow && isConfirme(statutNow)) {
      const { month, week_number } = monthAndWeek(String(after.date).slice(0, 10));
      const fiche = typeof after.fiche === 'string' ? JSON.parse(after.fiche) : after.fiche;
      const rdvFields: Record<string, any> = {
        date: String(after.date).slice(0, 10), heure: after.heure, month, week_number,
        client: after.client, telephone: after.telephone, adresse: after.adresse,
        code_postal: after.code_postal || null, departement: deptLabel,
        operation: after.operation, commercial: after.commercial, agent_name: after.agent_name,
        type_client: 'b2c', b2c_fiche: fiche || null, deleted_at: null, qualite_resultat: 'Confirme',
      };
      if (planningRdvId) {
        const r = await sb.from('rdv').update(rdvFields).eq('id', planningRdvId);
        if (r.error) throw new Error(r.error.message);
      } else {
        const r = await sb.from('rdv').insert(rdvFields).select().single();
        if (r.error) throw new Error(`Creation du RDV dans le Planning impossible : ${r.error.message}`);
        planningRdvId = r.data.id;
        await db.query('update rdv_requests set rdv_id = $1 where id = $2', [planningRdvId, params.id]);
      }
    } else if (planningRdvId && newStatut !== undefined) {
      // deja dans le Planning mais ne l'est plus : annule / reporte / changement d'avis
      const upd: Record<string, any> = {};
      if (isAnnuleConf(newStatut) || isChangementAvis(newStatut)) upd.statut = 'Annule';
      if (isReporteConf(newStatut) && after.date) {
        const { month, week_number } = monthAndWeek(String(after.date).slice(0, 10));
        Object.assign(upd, { date: String(after.date).slice(0, 10), heure: after.heure, month, week_number });
      }
      if (Object.keys(upd).length) await sb.from('rdv').update(upd).eq('id', planningRdvId);
    }

    if (newStatut !== undefined && newStatut !== cur.confirmation_statut) {
      await logStatusChange({
        entity_type: 'b2c', entity_id: params.id, field: 'confirmation',
        old_value: cur.confirmation_statut, new_value: newStatut,
        comment: b.confirmation_commentaire || (isReporteConf(newStatut) ? `Nouvelle date : ${after.date || '—'}` : null),
        user: me.displayName,
      });
    }
    if ('date' in b || 'heure' in b) {
      if ((b.date || null) !== (cur.date ? String(cur.date).slice(0, 10) : null) || (b.heure || null) !== (cur.heure || null)) {
        await logStatusChange({
          entity_type: 'b2c', entity_id: params.id, field: 'date_rdv',
          old_value: cur.date ? `${String(cur.date).slice(0, 10)} ${cur.heure || ''}`.trim() : null,
          new_value: b.date ? `${b.date} ${b.heure || ''}`.trim() : null, user: me.displayName,
        });
      }
    }
    logActivity(me, 'update_b2c_rdv', `${cur.client || ''}${newStatut ? ' -> ' + newStatut : ''}`, undefined);

    const { rows } = await db.query('select * from rdv_requests where id = $1', [params.id]);
    return NextResponse.json({ data: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser(req);
  if (!me || me.role === 'viewer' || me.role === 'relanceur') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    const db = directDb();
    const cur = (await db.query(`select * from rdv_requests where id = $1 and flow = 'manual'`, [params.id])).rows[0];
    if (!cur) return NextResponse.json({ error: 'RDV introuvable' }, { status: 404 });
    if (me.role === 'agent') {
      const agentId = me.userId.startsWith('agentpin-') ? me.userId.replace('agentpin-', '') : null;
      if (cur.agent_id !== agentId) return NextResponse.json({ error: 'Ce RDV ne t\'appartient pas.' }, { status: 403 });
      if (cur.valide_at) {
        return NextResponse.json({ error: 'Ce RDV est deja traite, il ne peut plus etre supprime.' }, { status: 403 });
      }
    }
    await db.query('delete from rdv_requests where id = $1', [params.id]);
    logActivity(me, 'delete_b2c_rdv', cur.client || '', undefined);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
