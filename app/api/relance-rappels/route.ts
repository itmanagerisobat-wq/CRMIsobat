import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { directDb } from '@/lib/db-direct';
import { isRappelStatut } from '@/lib/relance-statut';
import { getParametreValues } from '@/lib/accords-principe-db';

export const dynamic = 'force-dynamic';

// Relances et accords de principe dont le rappel est du aujourd'hui ou en retard.
export async function GET(req: NextRequest) {
  const actor = await getSessionUser(req);
  const univers = actor?.role === 'responsable_b2c' ? 'b2c' : (actor?.role === 'viewer' || actor?.role === 'relanceur') ? 'b2b'
    : (req.nextUrl.searchParams.get('univers') === 'b2c' ? 'b2c' : 'b2b');
  const today = new Date().toISOString().slice(0, 10);
  try {
    let rdvRows: any[] = [];
    let apRows: any[] = [];
    if (process.env.DATABASE_URL) {
      const db = directDb();
      rdvRows = (await db.query(
        `select id, raison_sociale, client, statut_relance, relance_date_rappel from rdv
         where deleted_at is null and relance_date_rappel is not null and relance_date_rappel <= $1
         and coalesce(type_client, 'b2b') = $2`, [today, univers])).rows;
      apRows = (await db.query(
        `select id, raison_sociale, client, statut, date_prochain_rappel from accords_principe
         where date_prochain_rappel is not null and date_prochain_rappel <= $1
         and coalesce(type_client, 'b2b') = $2`, [today, univers])).rows;
    } else {
      const db = supabaseAdmin();
      rdvRows = (await db.from('rdv').select('id, raison_sociale, client, statut_relance, relance_date_rappel, type_client')
        .is('deleted_at', null).not('relance_date_rappel', 'is', null).lte('relance_date_rappel', today)).data || [];
      rdvRows = rdvRows.filter((r: any) => (r.type_client || 'b2b') === univers);
      apRows = (await db.from('accords_principe').select('id, raison_sociale, client, statut, date_prochain_rappel, type_client')
        .not('date_prochain_rappel', 'is', null).lte('date_prochain_rappel', today)).data || [];
      apRows = apRows.filter((r: any) => (r.type_client || 'b2b') === univers);
    }
    // B2C : RDV valides non confirmes avec une date de rappel de relance
    let confRows: any[] = [];
    if (univers === 'b2c' && process.env.DATABASE_URL) {
      try {
        confRows = (await directDb().query(
          `select id, client, relance_date_rappel from rdv_requests
           where flow = 'manual' and type_client = 'b2c' and valide_at is not null
             and coalesce(confirmation_statut, '') not ilike 'confirm%'
             and relance_date_rappel is not null and relance_date_rappel <= $1`, [today])).rows;
      } catch { /* colonne absente tant que la migration 41 n'est pas lancee */ }
    }
    const rappelAp = await getParametreValues('statuts_ap_rappel');
    const relances = rdvRows
      .filter((r) => isRappelStatut(r.statut_relance))
      .map((r) => ({ id: r.id, type: 'relance', label: r.raison_sociale || r.client || 'Client', date: String(r.relance_date_rappel).slice(0, 10) }));
    const aps = apRows
      .filter((r) => r.statut && rappelAp.includes(r.statut))
      .map((r) => ({ id: r.id, type: 'ap', label: r.raison_sociale || r.client || 'Client', date: String(r.date_prochain_rappel).slice(0, 10) }));
    const confs = confRows.map((r) => ({ id: r.id, type: 'relance', label: r.client || 'Client', date: String(r.relance_date_rappel).slice(0, 10) }));
    return NextResponse.json({ data: [...relances, ...confs, ...aps] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message });
  }
}
