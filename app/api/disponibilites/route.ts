import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isWeekend, isFrenchHoliday } from '@/lib/holidays';
import { routeBetweenPostalCodes } from '@/lib/distance';

export const dynamic = 'force-dynamic';
export const maxDuration = 50;

const DAYS_AHEAD = 14;

function heureToMinutes(heure: string): number | null {
  const m = heure.match(/(\d{1,2})h(\d{2})?/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}
function minutesToHeure(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp');
  const region = req.nextUrl.searchParams.get('region');
  const monthParam = req.nextUrl.searchParams.get('month');
  if (!cp) return NextResponse.json({ error: 'Code postal requis' }, { status: 400 });

  const db = supabaseAdmin();
  const [paramsRes, rdvRes, pendingRes, zonesRes, baseRes] = await Promise.all([
    db.from('parametres').select('*'),
    db.from('rdv').select('*'),
    db.from('rdv_requests').select('*').eq('status', 'pending'),
    db.from('commercial_zones').select('*'),
    db.from('commercial_base').select('*'),
  ]);
  if (paramsRes.error) return NextResponse.json({ error: paramsRes.error.message }, { status: 500 });
  if (rdvRes.error) return NextResponse.json({ error: rdvRes.error.message }, { status: 500 });

  const paramMap: Record<string, string[]> = {};
  for (const row of paramsRes.data ?? []) paramMap[row.key] = row.values ?? [];
  const commerciaux = paramMap.commerciaux || [];
  const dureeVisite = parseInt((paramMap.duree_visite_minutes || ['60'])[0], 10) || 60;
  const maxRdvParCommercial = parseInt((paramMap.max_rdv_par_jour || ['3'])[0], 10) || 3;
  const seuilProximiteMinutes = parseInt((paramMap.temps_trajet_max || ['120'])[0], 10) || 120;
  const heureDebut = heureToMinutes((paramMap.heure_debut_journee || ['08h00'])[0]) ?? 480;
  const heureFin = heureToMinutes((paramMap.heure_fin_journee || ['18h00'])[0]) ?? 1080;

  const zonesByCommercial = new Map<string, string[]>();
  for (const z of zonesRes.data || []) {
    const arr = zonesByCommercial.get(z.commercial) || [];
    arr.push(z.region_code);
    zonesByCommercial.set(z.commercial, arr);
  }
  const baseByCommercial = new Map<string, string>();
  for (const b of baseRes.data || []) baseByCommercial.set(b.commercial, b.code_postal);

  const eligibleCommerciaux = commerciaux.filter((c) => {
    const zones = zonesByCommercial.get(c);
    if (!zones || zones.length === 0) return true;
    return region ? zones.includes(region) : false;
  });
  const noCoverage = commerciaux.length > 0 && eligibleCommerciaux.length === 0;

  // Seuls comptent les RDV qui occupent vraiment un commercial : ni supprimes, ni annules / non conformes / fermes,
  // ni RDV B2C d'un autre commercial. Les demandes en attente B2C saisies a la main (sans creneau) sont ignorees.
  const isClosedRdv = (r: any) =>
    !!r.deleted_at || r.statut === 'Annule' || !!r.qualite_non_conforme || !!r.qualite_annule ||
    String(r.statut || '').toLowerCase().includes('ferm') || String(r.qualite_resultat || '').toLowerCase().includes('ferm');
  const allRdv = [
    ...(rdvRes.data || [])
      .filter((r: any) => !isClosedRdv(r))
      .filter((r: any) => (r.type_client || 'b2b') === 'b2b' || r.is_pac || (r.commercial && commerciaux.includes(r.commercial))),
    ...(pendingRes.data || []).filter((r: any) => (r.flow || 'slot') !== 'manual' && (r.type_client || 'b2b') === 'b2b'),
  ].filter((r: any) => r.date && r.heure) as any[];

  const candidateDates: string[] = [];
  if (monthParam) {
    const m = monthParam.match(/^(\S+)\s+(\d{4})$/);
    const moisNoms = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    const monthIdx = m ? moisNoms.indexOf(m[1]) : -1;
    if (m && monthIdx >= 0) {
      const year = parseInt(m[2], 10);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
      for (let day = 1; day <= lastDay; day++) {
        const cand = new Date(Date.UTC(year, monthIdx, day));
        if (cand < today) continue;
        const iso = cand.toISOString().slice(0, 10);
        if (!isWeekend(iso) && !isFrenchHoliday(iso)) candidateDates.push(iso);
      }
    }
  } else {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    while (candidateDates.length < DAYS_AHEAD) {
      d.setUTCDate(d.getUTCDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      if (!isWeekend(iso) && !isFrenchHoliday(iso)) candidateDates.push(iso);
    }
  }

  const distCache = new Map<string, number | null>();
  async function minutesBetween(cpA: string, cpB: string): Promise<number | null> {
    if (cpA === cpB) return 0;
    const key = [cpA, cpB].sort().join('|');
    if (distCache.has(key)) return distCache.get(key)!;
    const result = await routeBetweenPostalCodes(cpA, cpB);
    const val = result ? result.minutes : null;
    distCache.set(key, val);
    return val;
  }

  type DayStatus = 'green' | 'orange' | 'yellow';
  interface HeureSlot { heure: string; occupied: boolean }
  interface DayResult { date: string; status: DayStatus; score: number; hasRdvThatDay: boolean; heures: HeureSlot[] }
  const days: DayResult[] = [];
  const excludedFull: string[] = []; // dates that would have been green/orange but hit capacity

  const poolCapacity = Math.max(1, eligibleCommerciaux.length) * maxRdvParCommercial;

  for (const date of candidateDates) {
    const rdvsThatDay = allRdv.filter((r) => r.date!.slice(0, 10) === date);
    const isFull = !noCoverage && rdvsThatDay.length >= poolCapacity;

    // distance source #1: nearest existing RDV that day
    const others = rdvsThatDay.filter((r) => r.code_postal);
    let nearestExistingMinutes = Infinity;
    for (const other of others) {
      const mins = await minutesBetween(cp, other.code_postal!);
      if (mins != null && mins < nearestExistingMinutes) nearestExistingMinutes = mins;
    }
    const hasExistingMatch = nearestExistingMinutes < Infinity;

    // distance source #2: nearest available eligible commercial's base address
    let nearestCommercialMinutes = Infinity;
    if (!hasExistingMatch) {
      for (const c of eligibleCommerciaux) {
        const base = baseByCommercial.get(c);
        if (!base) continue;
        const mins = await minutesBetween(cp, base);
        if (mins != null && mins < nearestCommercialMinutes) nearestCommercialMinutes = mins;
      }
    }
    const hasCommercialMatch = nearestCommercialMinutes < Infinity;

    let status: DayStatus;
    let score: number;
    if (hasExistingMatch) {
      status = nearestExistingMinutes < seuilProximiteMinutes ? 'green' : 'yellow';
      score = nearestExistingMinutes;
    } else if (hasCommercialMatch) {
      status = nearestCommercialMinutes < seuilProximiteMinutes ? 'orange' : 'yellow';
      score = nearestCommercialMinutes;
    } else {
      status = 'yellow';
      score = 99999;
    }

    if (isFull) {
      if (status === 'green' || status === 'orange') excludedFull.push(date);
      continue; // never offered, regardless of how good it would have been
    }

    // auto-generate heures every 30 minutes for the working day, but grey out
    // (occupied) any slot that's within the required gap (duree de visite +
    // trajet reel) of an existing RDV that day -- not just exact clashes
    // Un creneau est ferme seulement si TOUS les commerciaux eligibles sont pris : un RDV (meme lointain) ne bloque
    // que son propre commercial. Les RDV sans commercial connu (demandes en attente...) comptent chacun pour un commercial.
    const eligibleCount = Math.max(1, eligibleCommerciaux.length);
    const heures: HeureSlot[] = [];
    for (let t = heureDebut; t + dureeVisite <= heureFin; t += 30) {
      const busyNamed = new Set<string>();
      let busyUnnamed = 0;
      for (const other of rdvsThatDay) {
        const otherMinutes = heureToMinutes(other.heure!);
        if (otherMinutes == null) continue;
        let blocks = false;
        if (otherMinutes === t) {
          blocks = true; // exact clash
        } else if (other.code_postal) {
          const drivingMinutes = await minutesBetween(cp, other.code_postal);
          if (drivingMinutes != null) {
            const requiredGap = dureeVisite + drivingMinutes;
            if (Math.abs(t - otherMinutes) < requiredGap) blocks = true;
          }
        }
        if (!blocks) continue;
        if (other.commercial && eligibleCommerciaux.includes(other.commercial)) busyNamed.add(other.commercial);
        else busyUnnamed++;
      }
      const occupied = busyNamed.size + busyUnnamed >= eligibleCount;
      heures.push({ heure: minutesToHeure(t), occupied });
    }

    days.push({ date, status, score, hasRdvThatDay: rdvsThatDay.length > 0, heures });
  }

  days.sort((a, b) => {
    if (a.hasRdvThatDay !== b.hasRdvThatDay) return a.hasRdvThatDay ? -1 : 1;
    return a.score - b.score;
  });

  return NextResponse.json(
    { days, dureeVisite, noCoverage, excludedFull },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
