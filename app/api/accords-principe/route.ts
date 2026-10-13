import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { listAccordsPrincipe, insertAccordPrincipe, getParametreValues } from '@/lib/accords-principe-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getSessionUser(req);

  const filters: { agentId?: string; typeClient?: 'b2b' | 'b2c' } = {};

  // an agent only ever sees their own entries; everyone else (gestionnaire,
  // admin, relanceur) sees all of them, e.g. for the Relance page
  if (actor?.role === 'agent') {
    const agentId = actor.userId.startsWith('agentpin-') ? actor.userId.replace('agentpin-', '') : null;
    if (!agentId) return NextResponse.json({ data: [] });
    filters.agentId = agentId;
  }

  if (actor?.role === 'responsable_b2c') filters.typeClient = 'b2c';
  if (actor?.role === 'viewer' || actor?.role === 'relanceur') filters.typeClient = 'b2b';
  const universParam = actor?.role === 'responsable_b2c' ? 'b2c' : (actor?.role === 'viewer' || actor?.role === 'relanceur') ? 'b2b' : req.nextUrl.searchParams.get('univers');
  if (universParam === 'b2b' || universParam === 'b2c') filters.typeClient = universParam;

  try {
    const data = await listAccordsPrincipe(filters);
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const actor = await getSessionUser(req);
  const agentId = actor?.userId.startsWith('agentpin-') ? actor.userId.replace('agentpin-', '') : null;

  try {
    if (body.statut) {
      const rappelStatuts = await getParametreValues('statuts_ap_rappel');
      if (rappelStatuts.includes(body.statut) && !body.date_prochain_rappel) {
        return NextResponse.json({ error: 'Une date de prochain rappel est obligatoire pour ce statut.' }, { status: 400 });
      }
    }

    const data = await insertAccordPrincipe({
      raison_sociale: body.raison_sociale || null,
      client: body.client || null,
      telephone: body.telephone || null,
      adresse: body.adresse || null,
      operation: body.operation || null,
      agent_id: agentId,
      agent_name: actor?.displayName || null,
      statut: body.statut || null,
      commentaire: body.commentaire || null,
      date_prochain_rappel: body.date_prochain_rappel || null,
      type_client: body.type_client === 'b2c' ? 'b2c' : 'b2b',
    });

    logActivity(actor, 'create_accord_principe', `${data?.raison_sociale || data?.client || ''} (${data?.agent_name || 'agent inconnu'})`, undefined);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
