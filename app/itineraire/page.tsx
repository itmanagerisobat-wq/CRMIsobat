'use client';

import { useEffect, useState, useRef } from 'react';
import { Rdv } from '@/lib/types';
import { buildMonthLabel } from '@/lib/months';
import { useUnivers } from '@/lib/use-univers';
import MonthYearPicker from '../month-year-picker';

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}min`;
}

interface StopGap {
  rdv: Rdv;
  km: number | null;
  minutes: number | null;
  loading: boolean;
}

export default function ItinerairePage() {
  const now = new Date();
  const [month, setMonth] = useState(buildMonthLabel(now.getFullYear(), now.getMonth() + 1));
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [commerciauxList, setCommerciauxList] = useState<string[]>([]);
  const [commercialFilter, setCommercialFilter] = useState('');
  const univers = useUnivers();
  const univRef = useRef(univers);
  univRef.current = univers;
  const [basesByCommercial, setBasesByCommercial] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Rdv[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [byCommercial, setByCommercial] = useState<Record<string, StopGap[]>>({});

  useEffect(() => {
    fetch('/api/parametres', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setCommerciauxList((univers === 'b2c' ? j.data?.commerciaux_b2c : j.data?.commerciaux) || []));
    fetch('/api/commercial-base', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, string> = {};
        for (const b of j.data || []) map[b.commercial] = b.code_postal;
        setBasesByCommercial(map);
      });
  }, [univers]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/rdv?month=${encodeURIComponent(month)}`, { cache: 'no-store' });
      const json = await res.json();
      if (univRef.current !== univers) return;
      setRows((json.data || []).filter((r: Rdv) => (r.type_client || 'b2b') === univers));
      setLoading(false);
    }
    load();
  }, [month, univers]);

  const dayRows = rows.filter((r) => r.date && r.date.slice(0, 10) === date);

  function orderedFor(commercial: string): Rdv[] {
    const mine = dayRows.filter((r) => (r.commercial || '').trim().toLowerCase() === commercial.trim().toLowerCase());
    return [...mine].sort((a, b) => {
      const pa = parseInt((a.code_postal || '99999').replace(/\D/g, ''), 10) || 99999;
      const pb = parseInt((b.code_postal || '99999').replace(/\D/g, ''), 10) || 99999;
      return pa - pb;
    });
  }

  // first stop of the day shows its distance+duration from Paris (symbolic
  // starting point); each following stop shows the real gap from the
  // previous one.
  useEffect(() => {
    const map: Record<string, StopGap[]> = {};
    for (const c of commerciauxList) {
      const stops = orderedFor(c);
      map[c] = stops.map((rdv) => ({ rdv, km: null, minutes: null, loading: true }));
    }
    setByCommercial(map);

    (async () => {
      for (const c of commerciauxList) {
        const stops = orderedFor(c);
        for (let i = 0; i < stops.length; i++) {
          const cp = stops[i].code_postal;
          if (!cp) {
            setByCommercial((prev) => {
              const arr = [...(prev[c] || [])];
              if (arr[i]) arr[i] = { ...arr[i], loading: false };
              return { ...prev, [c]: arr };
            });
            continue;
          }
          try {
            const cp1 = i === 0 ? basesByCommercial[c] : stops[i - 1].code_postal;
            const url = cp1
              ? `/api/distance/between?cp1=${encodeURIComponent(cp1)}&cp2=${encodeURIComponent(cp)}`
              : `/api/distance?cp=${encodeURIComponent(cp)}`; // no base address on file -- fall back to Paris as a symbolic reference
            const res = await fetch(url);
            if (res.ok) {
              const j = await res.json();
              setByCommercial((prev) => {
                const arr = [...(prev[c] || [])];
                if (arr[i]) arr[i] = { ...arr[i], km: j.km, minutes: j.minutes ?? null, loading: false };
                return { ...prev, [c]: arr };
              });
            }
          } catch {
            // ignore, leave as unknown
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, rows, commerciauxList, basesByCommercial]);

  const maxStops = Math.max(0, ...commerciauxList.map((c) => (byCommercial[c] || []).length));
  const activeCommerciaux = commerciauxList
    .filter((c) => (byCommercial[c] || []).length > 0)
    .filter((c) => !commercialFilter || c === commercialFilter);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-1">Itineraire</h1>
      <p className="text-ink/60 text-sm mb-4">
        Ordre de visite suggere pour chaque commercial, avec la distance et la duree de trajet
        reelles entre chaque arret.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MonthYearPicker value={month} onChange={setMonth} />
        <select
          value={commercialFilter}
          onChange={(e) => setCommercialFilter(e.target.value)}
          className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">Tous les commerciaux</option>
          {commerciauxList.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
        />
        <button
          onClick={() => window.print()}
          className="bg-white border border-black/10 hover:bg-forest-light text-ink text-sm font-medium px-3 py-2 rounded-md"
        >
          Imprimer
        </button>
        <button
          onClick={() => { setExporting(true); window.location.href = `/api/itineraire/export?month=${encodeURIComponent(month)}`; setTimeout(() => setExporting(false), 2000); }}
          disabled={exporting}
          className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-3 py-2 rounded-md disabled:opacity-50"
        >
          {exporting ? 'Export...' : '↓ Exporter le mois (Excel)'}
        </button>
      </div>

      {loading && <p className="text-sm text-ink/40">Chargement...</p>}

      {!loading && activeCommerciaux.length === 0 && (
        <p className="text-sm text-ink/40 italic">Aucun RDV ce jour.</p>
      )}

      {activeCommerciaux.length > 0 && (
        <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-forest-light text-forest-dark text-left">
                <th className="px-1.5 py-1 font-semibold text-[9px] uppercase sticky left-0 bg-forest-light">Comm.</th>
                {Array.from({ length: maxStops }, (_, i) => (
                  <th key={i} colSpan={2} className="px-1.5 py-1 font-semibold text-[9px] uppercase whitespace-nowrap">
                    Arret {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCommerciaux.map((c) => {
                const stops = byCommercial[c] || [];
                return (
                  <tr key={c} className="border-t border-black/5">
                    <td className="px-1.5 py-1 font-medium whitespace-nowrap sticky left-0 bg-white">{c}</td>
                    {Array.from({ length: maxStops }, (_, i) => {
                      const s = stops[i];
                      return (
                        <>
                          <td key={`gap-${i}`} className="px-1 py-1 text-center text-gold whitespace-nowrap border-l border-black/5">
                            {s ? (
                              s.loading ? '...' : s.km != null ? (
                                <div className="leading-tight">
                                  <div className="text-sm font-bold">{i === 0 ? 'Depart' : '→'} {s.km}km</div>
                                  {s.minutes != null && <div className="text-xs font-bold text-gold/80">{formatDuration(s.minutes)}</div>}
                                </div>
                              ) : '—'
                            ) : ''}
                          </td>
                          <td key={`stop-${i}`} className="px-1.5 py-1 whitespace-nowrap">
                            {s && (
                              <>
                                <div className="font-medium">{s.rdv.heure || '—'} · {s.rdv.client || 'Client'}</div>
                                <div className="text-ink/50">{s.rdv.code_postal || s.rdv.departement || '—'}</div>
                              </>
                            )}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
