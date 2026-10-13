import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getSessionUser(req);
  if (!actor || actor.role === 'agent' || actor.role === 'viewer') {
    return NextResponse.json({ error: 'Acces reserve aux gestionnaires' }, { status: 403 });
  }
  const body = await req.json();
  const db = supabaseAdmin();
  const patch: Record<string, any> = {
    raison_sociale: body.raison_sociale,
    client: body.client,
    telephone: body.telephone,
    adresse: body.adresse,
    operation: body.operation,
    date: body.date,
    heure: body.heure,
  };
  // changement d'etat manuel (la validation qui cree le RDV du Planning passe par /validate)
  if (body.status && ['pending', 'refused', 'cancelled', 'validated'].includes(body.status)) {
    patch.status = body.status;
    patch.resolved_at = body.status === 'pending' ? null : new Date().toISOString();
  }
  const { data, error } = await db
    .from('rdv_requests')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getSessionUser(req);
  const db = supabaseAdmin();
  const { data: existing } = await db.from('rdv_requests').select('*').eq('id', params.id).single();
  if (!existing) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });

  if (actor?.role === 'agent') {
    const agentId = actor.userId.startsWith('agentpin-') ? actor.userId.replace('agentpin-', '') : null;
    if (existing.agent_id !== agentId) {
      return NextResponse.json({ error: 'Cette demande ne t\'appartient pas' }, { status: 403 });
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Cette demande a deja ete traitee, elle ne peut plus etre annulee.' }, { status: 403 });
    }
  }

  // non-agents with ?hard=1 : suppression definitive ; sinon simple annulation
  if (actor && actor.role !== 'agent' && req.nextUrl.searchParams.get('hard') === '1') {
    if (actor.role === 'viewer') return NextResponse.json({ error: 'Acces en lecture seule' }, { status: 403 });
    const del = await db.from('rdv_requests').delete().eq('id', params.id);
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { error } = await db
    .from('rdv_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
