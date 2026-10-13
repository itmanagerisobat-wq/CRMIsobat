'use client';

import { useEffect, useMemo, useState } from 'react';
import { referenceCpForDept, extractDeptCode } from '@/lib/departement-cp';
import { regionCodeForDept, REGIONS } from '@/lib/regions';
import { buildMonthLabel } from '@/lib/months';
import { AccordPrincipe } from '@/lib/types';
import MonthYearPicker from '../month-year-picker';

interface HeureSlot { heure: string; occupied: boolean }
interface DayResult { date: string; status: 'green' | 'orange' | 'yellow'; score: number; heures: HeureSlot[] }

interface Props {
  item: AccordPrincipe;
  onClose: () => void;
  onBooked: () => void;
}

/**
 * Lets an agent send an "accord de principe" straight to a real RDV slot
 * without leaving this page and re-typing the client's info -- same
 * availability search as "Prise de RDV", pre-filled with the AP's data.
 * The booking still goes through the normal pending-request + gestionnaire
 * validation flow, and once validated it follows the usual Relance rules
 * automatically, exactly like any other RDV.
 */
export default function BookRdvModal({ item, onClose, onBooked }: Props) {
  const [departements, setDepartements] = useState<string[]>([]);
  const [departement, setDepartement] = useState('');
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<DayResult[]>([]);
  const [noCoverage, setNoCoverage] = useState(false);
  const [excludedFull, setExcludedFull] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [pendingHeure, setPendingHeure] = useState<{ date: string; heure: string; status: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const now0 = new Date();
  const currentMonthLabel = buildMonthLabel(now0.getFullYear(), now0.getMonth() + 1);
  const [month, setMonth] = useState(currentMonthLabel);

  useEffect(() => {
    fetch('/api/parametres', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setDepartements(j.data?.departements || []));
  }, []);

  const regionCode = departement ? regionCodeForDept(extractDeptCode(departement)) : null;
  const region = regionCode ? REGIONS[regionCode] : null;

  async function search() {
    if (!departement) {
      setError('Choisis un departement.');
      return;
    }
    const cp = referenceCpForDept(departement);
    if (!cp) {
      setError('Departement non reconnu.');
      return;
    }
    setError('');
    setLoading(true);
    setSearched(true);
    setSelectedDay(null);
    const qs = new URLSearchParams({ cp });
    if (regionCode) qs.set('region', regionCode);
    if (month !== currentMonthLabel) qs.set('month', month);
    const res = await fetch(`/api/disponibilites?${qs.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || 'Erreur lors du calcul des disponibilites.');
      return;
    }
    setDays(json.days || []);
    setNoCoverage(!!json.noCoverage);
    setExcludedFull(json.excludedFull || []);
  }

  async function confirmBooking() {
    if (!pendingHeure) return;
    const cp = referenceCpForDept(departement);
    setBooking(true);
    setError('');
    try {
      const res = await fetch('/api/disponibilites/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: pendingHeure.date, heure: pendingHeure.heure, code_postal: cp, departement,
          slot_status: pendingHeure.status,
          raison_sociale: item.raison_sociale, client: item.client, telephone: item.telephone,
          adresse: item.adresse, operation: item.operation,
          accord_principe_id: item.id,
        }),
      });
      let json: any = {};
      try {
        json = await res.json();
      } catch {
        throw new Error(`Reponse inattendue du serveur (code ${res.status}). Reessaie.`);
      }
      setBooking(false);
      if (!res.ok) {
        setError(json.error || `Erreur lors de la demande (code ${res.status}).`);
        setPendingHeure(null);
        search();
        return;
      }
      onBooked();
    } catch (e: any) {
      setBooking(false);
      setError(e?.message || 'Erreur reseau : la demande n\'a pas pu etre envoyee.');
    }
  }

  const dayByDate: Record<string, DayResult> = {};
  for (const day of days) dayByDate[day.date] = day;
  const orderedDates = Object.keys(dayByDate).sort();

  const grid = useMemo(() => {
    if (orderedDates.length === 0) return [];
    const first = new Date(orderedDates[0] + 'T00:00:00Z');
    const last = new Date(orderedDates[orderedDates.length - 1] + 'T00:00:00Z');
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const cells: string[] = [];
    const cur = new Date(start);
    while (cur <= last || cells.length % 7 !== 0) {
      cells.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
      if (cur > last && cells.length % 7 === 0) break;
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedDates.join(',')]);

  const selectedDayResult = selectedDay ? dayByDate[selectedDay] : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[150] flex items-center justify-center px-4 py-8" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-ink text-lg">Envoyer en RDV</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">×</button>
        </div>
        <p className="text-ink/60 text-sm mb-4">
          {item.raison_sociale || item.client || 'Client'} -- la demande sera envoyee au
          gestionnaire pour validation, comme depuis "Prise de RDV".
        </p>

        <div className="bg-forest-light/40 rounded-md p-3 mb-4">
          <label className="block text-sm font-medium text-ink mb-1">Departement du client</label>
          <div className="flex gap-2">
            <input
              list="ap-departements-suggestions"
              value={departement}
              onChange={(e) => setDepartement(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Tape le nom ou le numero..."
              className="flex-1 border border-black/10 rounded-md px-3 py-2 text-sm"
            />
            <datalist id="ap-departements-suggestions">
              {departements.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
          {region && <p className="text-xs text-ink/50 mt-1">Region : {region}</p>}
          <div className="mt-3 flex items-center gap-2">
            <MonthYearPicker value={month} onChange={setMonth} />
            <button
              onClick={search}
              disabled={loading}
              className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
            >
              {loading ? 'Recherche...' : 'Chercher'}
            </button>
          </div>
          {error && <p className="text-statut-annule text-xs mt-2">{error}</p>}
        </div>

        {noCoverage && searched && (
          <div className="bg-blue-100 text-blue-800 rounded-md p-3 mb-4 text-sm">
            ⚠️ Aucun commercial ne couvre cette zone actuellement.
          </div>
        )}
        {excludedFull.length > 0 && searched && (
          <div className="bg-orange-100 text-orange-800 rounded-md p-3 mb-4 text-sm">
            ⚠️ {excludedFull.length} jour(s) auraient ete un bon choix mais sont deja complets.
          </div>
        )}

        {loading && <p className="text-sm text-ink/40">Calcul des disponibilites en cours...</p>}
        {!loading && searched && orderedDates.length === 0 && (
          <p className="text-sm text-ink/40">Aucune disponibilite trouvee.</p>
        )}

        {orderedDates.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-black/5 p-4">
              <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] font-semibold text-ink/40 text-center uppercase">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((dayStr) => {
                  const day = dayByDate[dayStr];
                  const dayNum = parseInt(dayStr.slice(-2), 10);
                  const isSelected = selectedDay === dayStr;
                  let cls = 'text-ink/20 bg-transparent';
                  if (day) {
                    if (day.status === 'green') cls = 'bg-green-500 text-white hover:bg-green-600 font-bold';
                    else if (day.status === 'orange') cls = 'bg-orange-400 text-white hover:bg-orange-500 font-bold';
                    else cls = 'bg-blue-500 text-white hover:bg-blue-600 font-bold';
                  }
                  if (isSelected) cls += ' ring-2 ring-forest ring-offset-1';
                  return (
                    <button
                      key={dayStr}
                      disabled={!day}
                      onClick={() => setSelectedDay(dayStr)}
                      className={`aspect-square rounded-md text-xs transition-colors ${cls}`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-black/5 p-4">
              <h3 className="text-sm font-semibold text-ink mb-2">
                {selectedDay
                  ? new Date(selectedDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Choisis un jour colore'}
              </h3>
              {selectedDayResult && (
                <div className="grid grid-cols-3 gap-1.5">
                  {selectedDayResult.heures.map((s) => (
                    <button
                      key={s.heure}
                      disabled={s.occupied}
                      onClick={() => setPendingHeure({ date: selectedDay!, heure: s.heure, status: selectedDayResult.status })}
                      className={`px-2 py-2 rounded-md text-xs font-medium text-center transition-colors ${
                        s.occupied
                          ? 'bg-ink/10 text-ink/30 cursor-not-allowed'
                          : selectedDayResult.status === 'green' ? 'bg-green-500 hover:bg-green-600 text-white'
                          : selectedDayResult.status === 'orange' ? 'bg-orange-400 hover:bg-orange-500 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {s.heure}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {pendingHeure && (
          <div className="fixed inset-0 bg-black/40 z-[160] flex items-center justify-center px-4" onClick={() => !booking && setPendingHeure(null)}>
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-semibold text-ink text-lg mb-2">Envoyer cette demande ?</h2>
              <p className="text-ink/70 text-sm mb-6 capitalize">
                {new Date(pendingHeure.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} a {pendingHeure.heure}
              </p>
              {error && <p className="text-statut-annule text-sm mb-4">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={confirmBooking}
                  disabled={booking}
                  className="flex-1 bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-50"
                >
                  {booking ? 'Envoi...' : 'Envoyer la demande'}
                </button>
                <button
                  onClick={() => setPendingHeure(null)}
                  disabled={booking}
                  className="flex-1 bg-white border border-black/10 text-ink text-sm font-medium py-2 rounded-md"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
