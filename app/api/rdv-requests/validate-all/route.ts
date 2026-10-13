import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { buildMonthLabel } from '@/lib/months';
import { weekNumberForDate } from '@/lib/weeks';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = await getSessionUser(req);
  if (!actor || actor.role === 'agent' || actor.role === 'viewer' || actor.role === 'relanceur' || actor.role === 'responsable_b2c') {
    return NextResponse.json({ error: 'Acces reserve aux gestionnaires' }, { status: 403 });
  }

  const db = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const univers = body?.univers === 'b2c' ? 'b2c' : 'b2b';
  const { data: pendingAll } = await db.from('rdv_requests').select('*').eq('status', 'pending');
  // jamais les demandes B2C saisies a la main (circuit /api/b2c-rdv), ni l'autre univers
  const pending = (pendingAll || []).filter((r: any) => (r.flow || 'slot') !== 'manual' && (r.type_client || 'b2b') === univers);

  let count = 0;
  for (const reqRow of pending || []) {
    const [year, monthNum] = reqRow.date.split('-').map((n: string) => parseInt(n, 10));
    const month = buildMonthLabel(year, monthNum);
    const week_number = weekNumberForDate(month, reqRow.date);

    const { error: insertError } = await db.from('rdv').insert({
      date: reqRow.date,
      heure: reqRow.heure,
      code_postal: reqRow.code_postal,
      departement: reqRow.departement,
      raison_sociale: reqRow.raison_sociale,
      client: reqRow.client,
      telephone: reqRow.telephone,
      adresse: reqRow.adresse,
      operation: reqRow.operation,
      agent_name: reqRow.agent_name,
      type_client: reqRow.type_client || 'b2b',
      month,
      week_number,
    });
    if (insertError) continue; // skip this one, keep going with the rest

    await db.from('rdv_requests').update({ status: 'validated', resolved_at: new Date().toISOString() }).eq('id', reqRow.id);
    count++;
  }

  logActivity(actor, 'create_rdv', `${count} demande(s) agent validee(s) en masse`);

  return NextResponse.json({ ok: true, count });
}
