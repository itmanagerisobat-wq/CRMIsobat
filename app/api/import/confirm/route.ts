import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { textIncludes } from '@/lib/text-match';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { rows, mode, filename } = await req.json(); // mode: 'add' | 'replace'
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne a importer' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const months = Array.from(new Set(rows.map((r: any) => r.month)));

  if (mode === 'replace') {
    const { error: delError } = await db.from('rdv').delete().in('month', months);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  const { data: batch, error: batchError } = await db
    .from('import_batches')
    .insert({ filename: filename || null, row_count: rows.length, months })
    .select()
    .single();
  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 });

  const { data: qualiteParam } = await db.from('parametres').select('values').eq('key', 'resultat_qualite').single();
  const positiveResultat = (qualiteParam?.values || []).find((v: string) => textIncludes(v, 'confirme')) || null;

  const clean = rows.map((r: any) => {
    // if the (possibly colour-mapped) statut represents a confirmed outcome,
    // auto-fill the Qualite phase so the dossier lands directly in the right
    // pipeline stage instead of sitting in "en attente de validation"
    const isConfirmed = positiveResultat && textIncludes(r.statut, 'confirme');
    return {
      month: r.month,
      week_number: r.week_number,
      date: r.date || null,
      heure: r.heure || null,
      operation: r.operation || null,
      prestataire: r.prestataire || null,
      code_postal: r.code_postal || null,
      commercial: r.commercial && r.commercial !== 'N/A' ? r.commercial : null,
      critere: r.critere || null,
      // "statut" tracks the VISIT outcome (Honore/Annule/Reporte/...), never
      // the Qualite-phase confirmation label -- a "confirmed" import means
      // the RDV is validated and ready, not that the visit already happened.
      statut: isConfirmed ? null : (r.statut || null),
      sous_statut: r.sous_statut || null,
      client: r.client || null,
      raison_sociale: r.raison_sociale || null,
      telephone: r.telephone || null,
      motif: r.motif || null,
      import_batch_id: batch.id,
      ...(isConfirmed ? {
        qualite_confirmation: true,
        qualite_criteres_respectes: true,
        qualite_resultat: positiveResultat,
        qualite_non_conforme: false,
      } : {}),
    };
  });

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < clean.length; i += CHUNK) {
    const chunk = clean.slice(i, i + CHUNK);
    const { error } = await db.from('rdv').insert(chunk);
    if (error) {
      return NextResponse.json({ error: error.message, inserted }, { status: 500 });
    }
    inserted += chunk.length;
  }

  return NextResponse.json({ ok: true, inserted, batchId: batch.id });
}
