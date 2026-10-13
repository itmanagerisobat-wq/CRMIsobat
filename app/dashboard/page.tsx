'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Rdv, CORE_STATUTS } from '@/lib/types';
import { parseMonthLabel, buildMonthLabel } from '@/lib/months';
import { REGIONS, regionCodeForDept } from '@/lib/regions';
import { useUnivers } from '@/lib/use-univers';
import { useRole } from '@/lib/use-role';
import { colorForName } from '@/lib/palette';
import MonthYearPicker from '../month-year-picker';
import DashboardCharts from './charts';
import PivotTable from './pivot-table';
import PilotageCommercial from './pilotage-commercial';
import ResponsableB2cStats from './responsable-b2c-stats';

const FranceRegionMap = dynamic(() => import('./france-region-map'), { ssr: false });

const CARD_BG_COLORS = ['bg-statut-nonhonore', 'bg-statut-honore', 'bg-statut-reporte', 'bg-statut-annule', 'bg-gold', 'bg-ink'];

function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const n = norm(v);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(v.trim());
  }
  return out;
}

function monthKey(label: string): number {
  const p = parseMonthLabel(label);
  return p ? p.year * 12 + p.monthNum : 0;
}

type PeriodMode = 'all' | 'month' | 'range';

export default function DashboardPage() {
  const role = useRole();
  if (role === null) return null;
  if (role === 'responsable_b2c') return <ResponsableB2cStats />;
  return <FullDashboard />;
}

function FullDashboard() {
  const now = new Date();
  const univers = useUnivers();
  const univRef = useRef(univers);
  univRef.current = univers;
  const [statutsRelance, setStatutsRelance] = useState<string[]>([]);
  const [rows, setRows] = useState<Rdv[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [monthSingle, setMonthSingle] = useState(buildMonthLabel(now.getFullYear(), now.getMonth() + 1));
  const [rangeFrom, setRangeFrom] = useState(buildMonthLabel(now.getFullYear(), 1));
  const [rangeTo, setRangeTo] = useState(buildMonthLabel(now.getFullYear(), now.getMonth() + 1));

  const [search, setSearch] = useState('');

  const [statsAffichees, setStatsAffichees] = useState<string[]>([]);
  const [commerciauxList, setCommerciauxList] = useState<string[]>([]);
  const [prestatairesList, setPrestatairesList] = useState<string[]>([]);
  const [operationsList, setOperationsList] = useState<string[]>([]);
  const [sousStatutsList, setSousStatutsList] = useState<string[]>([]);
  const [criteresCarte, setCriteresCarte] = useState<string[]>([]);
  const [departementsList, setDepartementsList] = useState<string[]>([]);

  const [carteCritere, setCarteCritere] = useState('Total RDV');
  const [carteOperation, setCarteOperation] = useState('');
  const [cartePrestataire, setCartePrestataire] = useState('');
  const [carteMonth, setCarteMonth] = useState('__ALL__');

  const [showCharts, setShowCharts] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showPilotage, setShowPilotage] = useState(false);
  const [objectifMonth, setObjectifMonth] = useState(buildMonthLabel(now.getFullYear(), now.getMonth() + 1));

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [rdvRes, paramsRes] = await Promise.all([
        fetch('/api/rdv', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/parametres', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (univRef.current !== univers) return;
      if (rdvRes.error) setError(rdvRes.error);
      setRows((rdvRes.data || []).filter((r: Rdv) => (r.type_client || 'b2b') === univers));
      setStatsAffichees(paramsRes.data?.stats_affichees || CORE_STATUTS);
      setStatutsRelance(paramsRes.data?.statuts_relance || []);
      setCommerciauxList(dedupe((univers === 'b2c' ? paramsRes.data?.commerciaux_b2c : paramsRes.data?.commerciaux) || []));
      setPrestatairesList(dedupe(paramsRes.data?.prestataires || []));
      setOperationsList(dedupe(paramsRes.data?.operations || []));
      setSousStatutsList(dedupe(paramsRes.data?.sous_statuts || []));
      setDepartementsList(paramsRes.data?.departements || []);
      const critList = paramsRes.data?.criteres_carte || ['Total RDV'];
      setCriteresCarte(critList);
      setCarteCritere(critList[0] || 'Total RDV');
      setLoading(false);
    }
    load();
  }, [univers]);

  const scoped = useMemo(() => {
    let r = rows;
    if (periodMode === 'month') {
      r = r.filter((x) => x.month === monthSingle);
    } else if (periodMode === 'range') {
      const from = monthKey(rangeFrom);
      const to = monthKey(rangeTo);
      r = r.filter((x) => {
        const k = monthKey(x.month);
        return k >= Math.min(from, to) && k <= Math.max(from, to);
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) =>
        (x.client || '').toLowerCase().includes(q) ||
        (x.prestataire || '').toLowerCase().includes(q) ||
        (x.commercial || '').toLowerCase().includes(q) ||
        (x.telephone || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, periodMode, monthSingle, rangeFrom, rangeTo, search]);

  const byMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.month, (counts.get(r.month) || 0) + 1);
    return Array.from(counts.entries())
      .map(([month, total]) => ({ month, total, sortKey: parseMonthLabel(month) }))
      .filter((x) => x.sortKey)
      .sort((a, b) => (a.sortKey!.year - b.sortKey!.year) || (a.sortKey!.monthNum - b.sortKey!.monthNum))
      .map((x) => ({ month: x.month.split(' ')[0].slice(0, 4), total: x.total }));
  }, [rows]);

  const byStatut = CORE_STATUTS.map((s) => ({ statut: s, total: scoped.filter((r) => r.statut === s).length }));

  const tauxParMois = useMemo(() => {
    const byM = new Map<string, { total: number; honore: number; key: number }>();
    for (const r of rows) {
      const k = monthKey(r.month);
      if (!k) continue;
      const cur = byM.get(r.month) || { total: 0, honore: 0, key: k };
      cur.total++;
      if (r.statut === 'honore') cur.honore++;
      byM.set(r.month, cur);
    }
    return Array.from(byM.entries())
      .sort((a, b) => a[1].key - b[1].key)
      .map(([month, v]) => ({
        month: month.split(' ')[0].slice(0, 4),
        taux: v.total ? Math.round((v.honore / v.total) * 100) : 0,
      }));
  }, [rows]);

  const operations = operationsList;
  const byOperation = operations
    .map((name) => ({ name, total: scoped.filter((r) => norm(r.operation) === norm(name)).length }))
    .sort((a, b) => b.total - a.total);

  const byPrestataireChart = prestatairesList
    .map((name) => ({ name, total: scoped.filter((r) => norm(r.prestataire) === norm(name)).length }))
    .sort((a, b) => b.total - a.total);

  const [cardOperation, setCardOperation] = useState('__ALL__');
  const cardScoped = cardOperation === '__ALL__' ? scoped : scoped.filter((r) => r.operation === cardOperation);
  const totalRdv = cardScoped.length;

  const statCards = statsAffichees.map((s) => {
    const count = cardScoped.filter((r) => r.statut === s || r.sous_statut === s).length;
    const pct = totalRdv ? Math.round((count / totalRdv) * 100) : 0;
    return { label: s, count, pct };
  });

  // Statut columns for the pivot tables also include sous-statuts (e.g.
  // "Devis signe") alongside the 5 main statuts.
  const statutEtSousStatutCols = [...CORE_STATUTS, ...sousStatutsList];

  const getCommercialOp = (row: string, col: string) =>
    scoped.filter((r) => norm(r.commercial) === norm(row) && norm(r.operation) === norm(col)).length;
  const getCommercialSt = (row: string, col: string) =>
    scoped.filter((r) => norm(r.commercial) === norm(row) && (r.statut === col || r.sous_statut === col)).length;
  const getPrestataireOp = (row: string, col: string) =>
    scoped.filter((r) => norm(r.prestataire) === norm(row) && norm(r.operation) === norm(col)).length;
  const getPrestataireSt = (row: string, col: string) =>
    scoped.filter((r) => norm(r.prestataire) === norm(row) && (r.statut === col || r.sous_statut === col)).length;

  // France map data: counts per region, using its OWN month filter
  // (independent from the page-level period filter) plus the map's own
  // critere/operation/prestataire filters.
  const mapCounts = useMemo(() => {
    const base = carteMonth === '__ALL__' ? rows : rows.filter((r) => r.month === carteMonth);
    const counts: Record<string, number> = {};
    for (const name of Object.values(REGIONS)) counts[name] = 0;
    for (const r of base) {
      if (carteOperation && norm(r.operation) !== norm(carteOperation)) continue;
      if (cartePrestataire && norm(r.prestataire) !== norm(cartePrestataire)) continue;
      if (carteCritere !== 'Total RDV' && r.statut !== carteCritere && r.sous_statut !== carteCritere) continue;
      const dep = (r.departement || '').trim();
      const deptCode = dep.split(' ')[0].padStart(2, '0');
      const regionCode = regionCodeForDept(deptCode);
      const regionName = regionCode ? REGIONS[regionCode] : null;
      if (!regionName) continue;
      counts[regionName] = (counts[regionName] || 0) + 1;
    }
    return counts;
  }, [rows, carteMonth, carteCritere, carteOperation, cartePrestataire]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink">Statistiques</h1>
      </div>

      {/* period selector */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex bg-white border border-black/10 rounded-md overflow-hidden text-sm">
          <button onClick={() => setPeriodMode('all')} className={`px-3 py-2 font-medium ${periodMode === 'all' ? 'bg-forest text-white' : 'text-ink/60'}`}>
            Toute la periode
          </button>
          <button onClick={() => setPeriodMode('month')} className={`px-3 py-2 font-medium ${periodMode === 'month' ? 'bg-forest text-white' : 'text-ink/60'}`}>
            Mois precis
          </button>
          <button onClick={() => setPeriodMode('range')} className={`px-3 py-2 font-medium ${periodMode === 'range' ? 'bg-forest text-white' : 'text-ink/60'}`}>
            Periode (du / au)
          </button>
        </div>

        {periodMode === 'month' && (
          <MonthYearPicker value={monthSingle} onChange={setMonthSingle} />
        )}
        {periodMode === 'range' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink/60">Du</span>
            <MonthYearPicker value={rangeFrom} onChange={setRangeFrom} />
            <span className="text-sm text-ink/60">au</span>
            <MonthYearPicker value={rangeTo} onChange={setRangeTo} />
          </div>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher client / prestataire / commercial / telephone..."
        className="w-full max-w-md border border-black/10 rounded-md px-3 py-2 text-sm bg-white mb-6"
      />

      {error && (
        <div className="bg-statut-annule/10 text-statut-annule rounded-md p-3 mb-4 text-sm">
          Erreur de connexion a la base : {error}.
        </div>
      )}
      {loading && <p className="text-ink/40 text-sm mb-4">Chargement...</p>}

      <div className="bg-white rounded-xl border border-black/5 shadow-sm p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex flex-col items-center justify-center text-center shrink-0 sm:w-32 mx-auto sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ISO BAT" className="w-24 h-24 object-contain mb-1.5" />
            <div className="text-xs text-ink/50 uppercase tracking-wide">ISO BAT</div>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total RDV" value={totalRdv} color="bg-ink" />
            {statCards.map((c, i) => (
              <StatCard
                key={c.label}
                label={c.label}
                value={c.count}
                sub={`${c.pct}%`}
                color={CARD_BG_COLORS[i % CARD_BG_COLORS.length]}
              />
            ))}
            {statsAffichees.length === 0 && !loading && (
              <div className="col-span-full text-sm text-ink/50 bg-gold-light rounded-md p-3">
                Aucun statut choisi pour les cartes. Va dans{' '}
                <a href="/parametres" className="underline font-medium">Parametres</a> → "Statuts
                affiches en cartes" pour en choisir.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-black/5 shadow-sm p-5 mb-8">
        <h3 className="font-semibold text-ink mb-1">Operation</h3>
        <p className="text-xs text-ink/50 mb-3">Filtre rapide pour se concentrer sur une famille de dossiers (cartes ci-dessus uniquement).</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCardOperation('__ALL__')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              cardOperation === '__ALL__' ? 'bg-forest-light text-forest-dark border-forest/30' : 'bg-white text-ink/60 border-black/10'
            }`}
          >
            Tous
          </button>
          {operationsList.map((o) => (
            <button
              key={o}
              onClick={() => setCardOperation(o)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                cardOperation === o ? 'bg-forest-light text-forest-dark border-forest/30' : 'bg-white text-ink/60 border-black/10'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowCharts((v) => !v)}
          className={`text-sm font-medium px-4 py-2 rounded-md border transition-colors ${
            showCharts ? 'bg-forest text-white border-forest' : 'bg-white text-ink border-black/10 hover:bg-forest-light'
          }`}
        >
          {showCharts ? '\u25b2' : '\u25bc'} Graphiques
        </button>
        <button
          onClick={() => setShowMap((v) => !v)}
          className={`text-sm font-medium px-4 py-2 rounded-md border transition-colors ${
            showMap ? 'bg-forest text-white border-forest' : 'bg-white text-ink border-black/10 hover:bg-forest-light'
          }`}
        >
          {showMap ? '\u25b2' : '\u25bc'} Stats geographique
        </button>
        <button
          onClick={() => setShowPilotage((v) => !v)}
          className={`text-sm font-medium px-4 py-2 rounded-md border transition-colors ${
            showPilotage ? 'bg-forest text-white border-forest' : 'bg-white text-ink border-black/10 hover:bg-forest-light'
          }`}
        >
          {showPilotage ? '\u25b2' : '\u25bc'} Commerciaux
        </button>
      </div>

      {showPilotage && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-ink">Pilotage commercial</h2>
            <MonthYearPicker value={objectifMonth} onChange={setObjectifMonth} />
          </div>
          <PilotageCommercial
            rows={rows.filter((r) => r.month === objectifMonth)}
            month={objectifMonth}
            commerciauxList={commerciauxList}
          />
        </div>
      )}

      {showCharts && (
        <div className="mb-6">
          <DashboardCharts
            byMonth={byMonth}
            byStatut={byStatut}
            byOperation={byOperation}
            byPrestataire={byPrestataireChart}
            operationsCanonical={operationsList}
            prestatairesCanonical={prestatairesList}
            tauxParMois={tauxParMois}
          />
        </div>
      )}

      {showMap && (
        <div className="bg-white rounded-lg border border-black/5 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-ink">Carte de France par region</h2>
            <div className="flex flex-wrap gap-2">
              <MonthYearPicker value={carteMonth} onChange={setCarteMonth} allowAll allLabel="Tous les mois" />
              <select value={carteCritere} onChange={(e) => setCarteCritere(e.target.value)} className="text-sm border border-black/10 rounded-md px-2 py-1.5 bg-white">
                {criteresCarte.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={carteOperation} onChange={(e) => setCarteOperation(e.target.value)} className="text-sm border border-black/10 rounded-md px-2 py-1.5 bg-white">
                <option value="">Toutes operations</option>
                {operationsList.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={cartePrestataire} onChange={(e) => setCartePrestataire(e.target.value)} className="text-sm border border-black/10 rounded-md px-2 py-1.5 bg-white">
                <option value="">Tous prestataires</option>
                {prestatairesList.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <FranceRegionMap counts={mapCounts} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <PivotTable title="Commercial x Operation" rowLabel="Commercial" rows={commerciauxList} cols={operations} getValue={getCommercialOp} />
        <PivotTable title="Commercial x Statut" rowLabel="Commercial" rows={commerciauxList} cols={statutEtSousStatutCols} getValue={getCommercialSt} />
        <PivotTable title="Prestataire x Operation" rowLabel="Prestataire" rows={prestatairesList} cols={operations} getValue={getPrestataireOp} />
        <PivotTable title="Prestataire x Statut" rowLabel="Prestataire" rows={prestatairesList} cols={statutEtSousStatutCols} getValue={getPrestataireSt} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`rounded-lg p-2.5 text-white text-center ${color}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-bold mt-0.5">
        {value}{sub && <span className="text-xs font-normal opacity-80 ml-1">({sub})</span>}
      </div>
    </div>
  );
}
