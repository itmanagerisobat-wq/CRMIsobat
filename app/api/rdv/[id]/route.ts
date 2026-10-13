import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { computePhase } from '@/lib/pipeline';
import { logStatusChange } from '@/lib/status-history';
import { textIncludes } from '@/lib/text-match';
import { buildMonthLabel } from '@/lib/months';
import { weekNumberForDate } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

// La responsable B2C ne peut modifier que des RDV B2C.
async function guardResponsableB2c(req: NextRequest, db: ReturnType<typeof supabaseAdmin>, id: string) {
  const actor = await getSessionUser(req);
  if (actor?.role !== 'responsable_b2c') return null;
  const { data } = await db.from('rdv').select('type_client').eq('id', id).maybeSingle();
  if (!data || data.type_client !== 'b2c') return NextResponse.json({ error: 'Acces reserve aux RDV B2C' }, { status: 403 });
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const db = supabaseAdmin();
  const denied = await guardResponsableB2c(req, db, params.id);
  if (denied) return denied;

  // Changer la date (report, reprogrammation...) deplace aussi le RDV dans le bon mois / la bonne semaine du Planning
  if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.date)) {
    const d = body.date.slice(0, 10);
    const [yy, mm] = d.split('-').map((n: string) => parseInt(n, 10));
    const monthLabel = buildMonthLabel(yy, mm);
    const weekNumber = weekNumberForDate(monthLabel, d);
    body.month = monthLabel;
    body.week_number = weekNumber;
  }

  const { data: before } = await db.from('rdv').select('*').eq('id', params.id).single();
  let reportLogDetails: string | null = null;
  if (before) {
    const oldPhase = computePhase(before);
    const merged = { ...before, ...body };

    // hard guard: a RDV can never be saved as "honore" without a commercial
    // already assigned, regardless of which screen tries to set it
    if (merged.statut === 'honore' && !merged.commercial) {
      return NextResponse.json(
        { error: 'Impossible de passer ce RDV en "Honore" : affecte d\'abord un commercial.' },
        { status: 400 }
      );
    }

    const newPhase = computePhase(merged);
    if (oldPhase !== newPhase) body.phase_changee_le = new Date().toISOString();

    // becoming "Reporte" (freshly, not already) bumps the report counter --
    // this can happen either via the Visite statut, or via the Qualite
    // phase's "Resultat final" when the client asks to postpone on the call
    const wasReporteVisite = textIncludes(before.statut, 'reporte');
    const becomesReporteVisite = textIncludes(body.statut, 'reporte');
    const wasReporteQualite = textIncludes(before.qualite_resultat, 'reporte');
    const becomesReporteQualite = textIncludes(body.qualite_resultat, 'reporte');
    if ((becomesReporteVisite && !wasReporteVisite) || (becomesReporteQualite && !wasReporteQualite)) {
      body.nombre_reports = (before.nombre_reports || 0) + 1;

      const oldDate = before.date ? new Date(before.date).toLocaleDateString('fr-FR') : 'aucune date';
      const oldComment = before.motif || before.qualite_commentaire || 'aucun commentaire';
      const oldCommercial = before.commercial || 'aucun commercial';
      reportLogDetails = `Report #${body.nombre_reports} -- commercial : ${oldCommercial} -- ancienne date : ${oldDate} -- ancien commentaire : "${oldComment}"`;
    }
  }

  const { data, error } = await db
    .from('rdv')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actor = await getSessionUser(req);
  if (before) {
    const tracked: Record<string, string | null> = {
      statut: null, sous_statut: null,
      papiers_statut: body.papiers_commentaire ?? null,
      installation_statut: body.installation_commentaire ?? null,
    };
    for (const f of Object.keys(tracked)) {
      if (f in body) {
        await logStatusChange({
          entity_type: 'rdv', entity_id: params.id, field: f,
          old_value: before[f], new_value: body[f], comment: tracked[f], user: actor?.displayName,
        });
      }
    }
  }
  logActivity(
    actor,
    'update_rdv',
    reportLogDetails || `${data?.commercial || ''} ${data?.operation || ''} - ${data?.month || ''}`.trim(),
    data?.id
  );

  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseAdmin();
  const denied = await guardResponsableB2c(req, db, params.id);
  if (denied) return denied;
  const { data: existing } = await db.from('rdv').select('*').eq('id', params.id).single();
  // soft delete -- moves the RDV to the "RDV supprime" trash instead of
  // erasing it, so a mistaken suppression can be restored
  const { error } = await db.from('rdv').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actor = await getSessionUser(req);
  logActivity(actor, 'delete_rdv', `${existing?.commercial || ''} ${existing?.operation || ''} - ${existing?.month || ''}`.trim(), params.id);

  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // restores a soft-deleted RDV from the trash
  const db = supabaseAdmin();
  const { data, error } = await db.from('rdv').update({ deleted_at: null }).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actor = await getSessionUser(req);
  logActivity(actor, 'update_rdv', 'RDV restaure depuis la corbeille', params.id);

  return NextResponse.json({ data });
}
