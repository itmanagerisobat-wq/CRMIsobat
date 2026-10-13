import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { updateAccordPrincipe } from '@/lib/accords-principe-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json(); // { date, heure, code_postal, departement, slot_status, raison_sociale, client, telephone, adresse, operation, accord_principe_id? }
  if (!body.date || !body.heure) {
    return NextResponse.json({ error: 'Date et heure requises' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // re-check this exact hour isn't already taken (avoid race conditions
  // between two agents booking the same instant)
  const [{ data: existingRdv }, { data: existingPending }] = await Promise.all([
    db.from('rdv').select('id, heure').eq('date', body.date).eq('heure', body.heure),
    db.from('rdv_requests').select('id, heure').eq('date', body.date).eq('heure', body.heure).eq('status', 'pending'),
  ]);
  if ((existingRdv || []).length > 0 || (existingPending || []).length > 0) {
    return NextResponse.json({ error: 'Ce creneau vient d\'etre pris, choisis-en un autre.' }, { status: 409 });
  }

  const actor = await getSessionUser(req);
  const agentId = actor?.userId.startsWith('agentpin-') ? actor.userId.replace('agentpin-', '') : null;

  // agent bookings never create a real RDV directly -- they create a
  // pending request that a Gestionnaire/Admin must validate first.
  const { data, error } = await db
    .from('rdv_requests')
    .insert({
      date: body.date,
      heure: body.heure,
      code_postal: body.code_postal || null,
      departement: body.departement || null,
      raison_sociale: body.raison_sociale || null,
      client: body.client || null,
      telephone: body.telephone || null,
      adresse: body.adresse || null,
      operation: body.operation || null,
      agent_id: agentId,
      agent_name: actor?.displayName || null,
      slot_status: body.slot_status || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Booking sent from the "Accords de principe" page: mark that AP entry as
  // converted so its own UI can stop offering "Envoyer en RDV" again --
  // this is a soft marker only, the two tables stay otherwise independent
  // (no foreign key, no merge of fields).
  if (body.accord_principe_id) {
    try {
      await updateAccordPrincipe(body.accord_principe_id, { rdv_envoye_at: new Date().toISOString() });
    } catch {
      // non-fatal -- the RDV request itself was created successfully either way
    }
  }

  return NextResponse.json({ data });
}
