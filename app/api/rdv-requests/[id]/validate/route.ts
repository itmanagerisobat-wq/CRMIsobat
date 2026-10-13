import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { buildMonthLabel } from '@/lib/months';
import { weekNumberForDate } from '@/lib/weeks';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getSessionUser(req);
  if (!actor || actor.role === 'agent' || actor.role === 'viewer' || actor.role === 'relanceur' || actor.role === 'responsable_b2c') {
    return NextResponse.json({ error: 'Acces reserve aux gestionnaires' }, { status: 403 });
  }

  const db = supabaseAdmin();
  const { data: reqRow } = await db.from('rdv_requests').select('*').eq('id', params.id).single();
  if (!reqRow || reqRow.status !== 'pending') {
    return NextResponse.json({ error: 'Demande introuvable ou deja traitee' }, { status: 404 });
  }

  const [year, monthNum] = reqRow.date.split('-').map((n: string) => parseInt(n, 10));
  const month = buildMonthLabel(year, monthNum);
  const week_number = weekNumberForDate(month, reqRow.date);

  const { data: rdv, error: insertError } = await db
    .from('rdv')
    .insert({
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
    })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await db.from('rdv_requests').update({ status: 'validated', resolved_at: new Date().toISOString() }).eq('id', params.id);

  logActivity(actor, 'create_rdv', `Demande agent validee : ${reqRow.agent_name || ''} - ${reqRow.date} ${reqRow.heure}`, rdv?.id);

  return NextResponse.json({ ok: true, rdv });
}
