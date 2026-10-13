'use client';

import { useEffect, useMemo, useState } from 'react';
import { Rdv } from '@/lib/types';
import { buildMonthLabel, parseMonthLabel } from '@/lib/months';
import { weekNumberForDate } from '@/lib/weeks';
import { isWeekend, isFrenchHoliday } from '@/lib/holidays';
import { useRole } from '@/lib/use-role';
import { useUnivers } from '@/lib/use-univers';
import MonthYearPicker from '../month-year-picker';

const STATUT_DOT: Record<string, string> = {
  'non honore': 'bg-statut-nonhonore',
  honore: 'bg-statut-honore',
  Reporte: 'bg-statut-reporte',
  Annule: 'bg-statut-annule',
  'Non confirme': 'bg-orange-400',
};

export default function CalendrierPage() {
  const role = useRole();
  const univers = useUnivers();
  const canReschedule = role === 'admin' || role === 'gestionnaire';
  const now = new Date();
  const [month, setMonth] = useState(buildMonthLabel(now.getFullYear(), now.getMonth() + 1));
  const [rows, setRows] = useState<Rdv[]>([]);
  const [maxParJour, setMaxParJour] = useState(3);
  const [maxParCommercial, setMaxParCommercial] = useState(3);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<Rdv | null>(null);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [commerciaux, setCommerciaux] = useState<string[]>([]);
  const [operations, setOperations] = useState<string[]>([]);
  const [heures, setHeures] = useState<string[]>([]);
  const [pacOpen, setPacOpen] = useState(false);
  const [pac, setPac] = useState({ date: '', heure: '', commercial: '', operation: 'PAC', client: '', telephone: '', adresse: '', code_postal: '' });
  const [pacError, setPacError] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/rdv?month=${encodeURIComponent(month)}`, { cache: 'no-store' });
    const json = await res.json();
    const raw: Rdv[] = json.data || [];
    // exclude RDVs that Planning has already routed out of the active
    // pipeline (non conforme / annule / operation fermee) -- they clutter
    // the calendar otherwise, without being real upcoming/past visits
    const filtered = raw.filter((r) => {
      // les RDV PAC (saisis ici, enregistres dans le Planning B2C) sont aussi visibles dans le calendrier B2B
      const sameUnivers = (r.type_client || 'b2b') === univers || (univers === 'b2b' && r.type_client === 'b2c' && !!r.is_pac);
      if (!sameUnivers) return false;
      if (r.qualite_non_conforme) return false;
      if (r.qualite_annule || r.statut === 'Annule') return false;
      const qResultat = (r.qualite_resultat || '').toLowerCase();
      const vStatut = (r.statut || '').toLowerCase();
      if (qResultat.includes('ferm') || vStatut.includes('ferm')) return false;
      return true;
    });
    setRows(filtered);
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, univers]);

  useEffect(() => {
    fetch('/api/parametres', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const commerciauxCount = (j.data?.commerciaux || []).length || 1;
        const perCommercial = parseInt((j.data?.max_rdv_par_jour || ['3'])[0], 10) || 3;
        setMaxParJour(commerciauxCount * perCommercial);
        setMaxParCommercial(perCommercial);
        const all = [...(j.data?.commerciaux || []), ...(j.data?.commerciaux_b2c || [])];
        setCommerciaux(all.filter((c: string, i: number) => all.indexOf(c) === i));
        const ops = [...(j.data?.operations || []), ...(j.data?.preconisations_b2c || [])];
        setOperations(ops.filter((c: string, i: number) => ops.indexOf(c) === i));
        setHeures(j.data?.heures || []);
      });
  }, []);

  const parsed = parseMonthLabel(month);
  const grid = useMemo(() => {
    if (!parsed) return [];
    const first = new Date(Date.UTC(parsed.year, parsed.monthNum - 1, 1));
    const lastDate = new Date(Date.UTC(parsed.year, parsed.monthNum, 0)).getUTCDate();
    const startDow = (first.getUTCDay() + 6) % 7;
    const cells: (string | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= lastDate; d++) {
      cells.push(`${parsed.year}-${String(parsed.monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [parsed]);

  function rdvsForDay(dateStr: string) {
    return rows.filter((r) => r.date && r.date.slice(0, 10) === dateStr).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
  }

  const activeDay = selectedDay || hoverDay;
  const activeRdvs = activeDay ? rdvsForDay(activeDay) : [];
  const activeByCommercial = useMemo(() => {
    const map: Record<string, Rdv[]> = {};
    for (const r of activeRdvs) {
      const key = r.commercial || 'Non assigne';
      (map[key] = map[key] || []).push(r);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [activeRdvs]);
  const todayStr = now.toISOString().slice(0, 10);

  async function openReschedule(r: Rdv) {
    setRescheduling(r);
    setNewDate(r.date ? r.date.slice(0, 10) : '');
  }

  async function saveReschedule() {
    if (!rescheduling || !newDate) return;
    setSaving(true);
    const [year, monthNum] = newDate.split('-').map((n) => parseInt(n, 10));
    const newMonth = buildMonthLabel(year, monthNum);
    await fetch(`/api/rdv/${rescheduling.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, month: newMonth }),
    });
    setSaving(false);
    setRescheduling(null);
    load();
  }

  function openPac() {
    setPac({ date: selectedDay || '', heure: '', commercial: '', operation: 'PAC', client: '', telephone: '', adresse: '', code_postal: '' });
    setPacError('');
    setPacOpen(true);
  }

  async function savePac() {
    setPacError('');
    if (!pac.date || !pac.heure || !pac.commercial || !pac.operation.trim() || !pac.client.trim()) {
      setPacError('Date, heure, commercial, operation et client sont obligatoires.');
      return;
    }
    const clash = rows.filter((r) => r.date && r.date.slice(0, 10) === pac.date && r.commercial === pac.commercial && (r.heure || '') === pac.heure);
    if (clash.length > 0 && !confirm(`${pac.commercial} a deja ${clash.length} RDV le ${pac.date} a ${pac.heure}. Ajouter quand meme ?`)) return;
    setSaving(true);
    const [y, m] = pac.date.split('-').map((n) => parseInt(n, 10));
    const monthLabel = buildMonthLabel(y, m);
    const week_number = weekNumberForDate(monthLabel, pac.date);
    const res = await fetch('/api/rdv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: pac.date, heure: pac.heure, month: monthLabel, week_number,
        commercial: pac.commercial, operation: pac.operation.trim(), client: pac.client.trim(),
        telephone: pac.telephone || null, adresse: pac.adresse || null, code_postal: pac.code_postal || null,
        type_client: 'b2c', is_pac: true, qualite_resultat: 'Confirme',
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setPacError(j.error || 'Erreur lors de l\'enregistrement.'); return; }
    setPacOpen(false);
    if (pac.date.slice(0, 7) !== `${parsed?.year}-${String(parsed?.monthNum).padStart(2, '0')}`) setMonth(monthLabel); else load();
  }

  const canPac = univers === 'b2b' && (role === 'admin' || role === 'gestionnaire');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-ink">Calendrier</h1>
        <div className="flex items-center gap-2">
          {canPac && (
            <button onClick={openPac} className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-md">
              + RDV PAC
            </button>
          )}
          <MonthYearPicker value={month} onChange={setMonth} />
        </div>
      </div>
      <p className="text-ink/60 text-sm mb-2">
        Vue mensuelle des RDV avec date fixee. Survole un jour pour un apercu, clique pour le detail complet.
      </p>
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-ink/60">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-green-500" /> Jour avec RDV</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-ink" /> Complet</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-ink/10" /> Week-end / ferie</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block border-2 border-forest" /> Aujourd'hui</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-violet-200 border border-violet-400" /> RDV PAC</span>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-black/5 p-5 shadow-sm">
          <div className="grid grid-cols-7 gap-2 mb-2 text-xs font-semibold text-ink/40 text-center uppercase tracking-wide">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {grid.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const dayRdvs = rdvsForDay(dateStr);
              const dayNum = parseInt(dateStr.slice(-2), 10);
              const isSelected = selectedDay === dateStr;
              const isToday = dateStr === todayStr;
              const nonWorking = isWeekend(dateStr) || isFrenchHoliday(dateStr);
              const hasRdv = dayRdvs.length > 0;
              const isFull = dayRdvs.length >= maxParJour;

              let bgClass = 'bg-white border-black/10 hover:border-forest/30 hover:shadow-md';
              let textClass = 'text-ink/70';
              if (nonWorking) bgClass = 'bg-ink/5 border-transparent';
              if (hasRdv) {
                if (isFull) {
                  bgClass = 'bg-ink border-ink hover:shadow-md hover:scale-[1.03]';
                  textClass = 'text-white';
                } else {
                  bgClass = 'bg-green-500 border-green-600 hover:shadow-md hover:scale-[1.03]';
                  textClass = 'text-white';
                }
              }
              if (isSelected) bgClass += ' ring-2 ring-forest ring-offset-1';

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                  onMouseEnter={() => setHoverDay(dateStr)}
                  onMouseLeave={() => setHoverDay(null)}
                  className={`relative aspect-square rounded-lg border p-2 flex flex-col transition-all duration-150 ${bgClass} ${isToday ? 'outline outline-2 outline-forest outline-offset-1' : ''}`}
                >
                  <span className={`text-xs font-semibold ${textClass}`}>{dayNum}</span>
                  {hasRdv && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold leading-none ${textClass}`}>{dayRdvs.length}</span>
                      <span className={`text-[9px] uppercase tracking-wide ${textClass} opacity-80`}>RDV</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl border border-black/5 p-5 shadow-sm">
          <h2 className="font-semibold text-ink mb-1">
            {activeDay
              ? new Date(activeDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Survole ou clique un jour'}
          </h2>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} className="text-xs text-forest underline mb-3">
              Fermer le detail
            </button>
          )}
          {loading && <p className="text-sm text-ink/40 mt-2">Chargement...</p>}
          {!loading && activeDay && activeRdvs.length === 0 && (
            <p className="text-sm text-ink/40 mt-2">Aucun RDV ce jour.</p>
          )}
          <div className="space-y-4 mt-2 max-h-[420px] overflow-y-auto">
            {activeByCommercial.map(([commercial, list]) => {
              const isComplet = list.length >= maxParCommercial;
              return (
                <div key={commercial}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-base font-extrabold uppercase text-ink">{commercial}</h3>
                    {isComplet && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-statut-annule text-white">Complet</span>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-black/5 rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-forest-light/50 text-left">
                          <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Heure</th>
                          <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Operation</th>
                          <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Client</th>
                          <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Departement</th>
                          <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Statut</th>
                          <th className="px-2 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr key={r.id} className={`border-t border-black/5 ${r.is_pac ? 'bg-violet-100 hover:bg-violet-200/70' : 'hover:bg-forest-light/30'}`}>
                            <td className="px-2 py-1.5 whitespace-nowrap font-semibold">{r.heure || '—'}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{r.operation || '—'}{r.is_pac && <span className="ml-1 text-[9px] font-bold bg-violet-600 text-white rounded px-1">PAC</span>}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{r.client || r.raison_sociale || '—'}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{r.departement || '—'}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {(r.nombre_reports || 0) > 0 && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                                      (r.nombre_reports || 0) === 1 ? 'bg-ink/40' : (r.nombre_reports || 0) === 2 ? 'bg-orange-500' : 'bg-statut-annule'
                                    }`}
                                    title={`Reporte ${r.nombre_reports} fois`}
                                  >
                                    ↻{r.nombre_reports}
                                  </span>
                                )}
                                <span className={`w-2.5 h-2.5 rounded-full ${STATUT_DOT[r.statut || ''] || 'bg-ink/30'}`} />
                                <span className="text-[10px] text-ink/50">{r.statut || 'Confirme'}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {canReschedule && selectedDay && (
                                <button onClick={() => openReschedule(r)} className="text-xs text-forest underline">
                                  Reprogrammer
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedDay && (
            <a href="/planning" className="text-forest text-xs underline mt-3 inline-block">
              Modifier dans Planning →
            </a>
          )}
        </div>
      </div>

      {pacOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => !saving && setPacOpen(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-ink text-lg mb-1">Nouveau RDV PAC</h2>
            <p className="text-xs text-ink/50 mb-3">Le RDV est enregistre dans le Planning B2C, deja confirme et affecte. Il apparait en violet dans ce calendrier.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Date</label>
                <input type="date" value={pac.date} onChange={(e) => setPac({ ...pac, date: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Heure</label>
                {heures.length > 0 ? (
                  <select value={pac.heure} onChange={(e) => setPac({ ...pac, heure: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="">—</option>
                    {heures.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                ) : (
                  <input type="time" value={pac.heure} onChange={(e) => setPac({ ...pac, heure: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Commercial</label>
                <select value={pac.commercial} onChange={(e) => setPac({ ...pac, commercial: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">— choisir —</option>
                  {commerciaux.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Operation</label>
                <input list="pac-operations" value={pac.operation} onChange={(e) => setPac({ ...pac, operation: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
                <datalist id="pac-operations">{operations.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink/60 mb-1">Client (nom et prenom)</label>
                <input value={pac.client} onChange={(e) => setPac({ ...pac, client: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Telephone</label>
                <input value={pac.telephone} onChange={(e) => setPac({ ...pac, telephone: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Code postal</label>
                <input value={pac.code_postal} onChange={(e) => setPac({ ...pac, code_postal: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink/60 mb-1">Adresse</label>
                <input value={pac.adresse} onChange={(e) => setPac({ ...pac, adresse: e.target.value })} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            {pacError && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mt-3">{pacError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={savePac} disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2 rounded-md disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Enregistrer le RDV PAC'}
              </button>
              <button onClick={() => setPacOpen(false)} disabled={saving} className="flex-1 bg-white border border-black/10 text-ink text-sm font-medium py-2 rounded-md">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {rescheduling && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => !saving && setRescheduling(null)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-ink text-lg mb-3">Reprogrammer ce RDV</h2>
            <p className="text-sm text-ink/60 mb-3">
              {rescheduling.heure || '—'} · {rescheduling.client || rescheduling.raison_sociale || 'Client non precise'}
            </p>
            <label className="block text-xs font-medium text-ink/60 mb-1">Nouvelle date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={saveReschedule}
                disabled={saving || !newDate}
                className="flex-1 bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Confirmer'}
              </button>
              <button
                onClick={() => setRescheduling(null)}
                disabled={saving}
                className="flex-1 bg-white border border-black/10 text-ink text-sm font-medium py-2 rounded-md"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
