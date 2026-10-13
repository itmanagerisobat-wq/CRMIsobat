import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logStatusChange } from '@/lib/status-history';
import { logActivity } from '@/lib/activity';
import { getAccordPrincipeById, updateAccordPrincipe, deleteAccordPrincipe, getParametreValues } from '@/lib/accords-principe-db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const actor = await getSessionUser(req);

  try {
    // an agent may only edit their own entry
    if (actor?.role === 'agent') {
      const agentId = actor.userId.startsWith('agentpin-') ? actor.userId.replace('agentpin-', '') : null;
      const existing = await getAccordPrincipeById(params.id);
      if (!existing || existing.agent_id !== agentId) {
        return NextResponse.json({ error: 'Tu ne peux modifier que tes propres accords de principe.' }, { status: 403 });
      }
    }

    const allowed: Record<string, any> = {};
    for (const key of ['raison_sociale', 'client', 'telephone', 'adresse', 'operation', 'statut', 'commentaire', 'date_prochain_rappel', 'relanceur_commentaire']) {
      if (key in body) allowed[key] = body[key];
    }

    if ('statut' in allowed && allowed.statut) {
      const rappelStatuts = await getParametreValues('statuts_ap_rappel');
      if (rappelStatuts.includes(allowed.statut)) {
        const nextDate = 'date_prochain_rappel' in allowed ? allowed.date_prochain_rappel : (await getAccordPrincipeById(params.id))?.date_prochain_rappel;
        if (!nextDate) {
          return NextResponse.json({ error: 'Une date de prochain rappel est obligatoire pour ce statut.' }, { status: 400 });
        }
      }
    }

    allowed.updated_at = new Date().toISOString();

    const before = 'statut' in allowed ? await getAccordPrincipeById(params.id) : null;
    const data = await updateAccordPrincipe(params.id, allowed);
    if (before && 'statut' in allowed) {
      await logStatusChange({
        entity_type: 'ap', entity_id: params.id, field: 'statut_ap',
        old_value: before.statut, new_value: allowed.statut,
        comment: (body.relanceur_commentaire || (allowed.date_prochain_rappel ? `Prochain rappel : ${allowed.date_prochain_rappel}` : null)) || null,
        user: actor?.displayName,
      });
    }
    logActivity(actor, 'update_accord_principe', `${data?.raison_sociale || data?.client || ''}${allowed.statut ? ' -> ' + allowed.statut : ''}`, undefined);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getSessionUser(req);

  try {
    if (actor?.role === 'agent') {
      const agentId = actor.userId.startsWith('agentpin-') ? actor.userId.replace('agentpin-', '') : null;
      const existing = await getAccordPrincipeById(params.id);
      if (!existing || existing.agent_id !== agentId) {
        return NextResponse.json({ error: 'Tu ne peux supprimer que tes propres accords de principe.' }, { status: 403 });
      }
    }

    await deleteAccordPrincipe(params.id);
    logActivity(actor, 'delete_accord_principe', params.id, undefined);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
