'use client';

import { useEffect, useMemo, useState } from 'react';
import { referenceCpForDept, extractDeptCode } from '@/lib/departement-cp';
import { regionCodeForDept, REGIONS } from '@/lib/regions';
import { buildMonthLabel, parseMonthLabel } from '@/lib/months';
import { Rdv } from '@/lib/types';
import MonthYearPicker from '../month-year-picker';

interface HeureSlot { heure: string; occupied: boolean }
interface DayResult { date: string; status: 'green' | 'orange' | 'yellow'; score: number; heures: HeureSlot[] }

interface MyRequest {
  id: string;
  date: string;
  heure: string;
  status: 'pending' | 'validated' | 'refused' | 'cancelled';
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', validated: 'Validee', refused: 'Refusee', cancelled: 'Annulee',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gold/10 text-gold', validated: 'bg-statut-honore/10 text-statut-honore',
  refused: 'bg-statut-annule/10 text-statut-annule', cancelled: 'bg-ink/10 text-ink/50',
};
const FIELD_KEY_MAP: Record<string, string> = {
  'Raison sociale': 'raison_sociale', 'Responsable': 'client', 'Telephone': 'telephone',
  'Adresse': 'adresse', 'Operation': 'operation',
};

export default function DisponibilitesPage() {
  const [departements, setDepartements] = useState<string[]>([]);
  const [departement, setDepartement] = useState('');
  const [champsAgent, setChampsAgent] = useState<string[]>([]);
  const [operationsList, setOperationsList] = useState<string[]>([]);
  const [clientFields, setClientFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<DayResult[]>([]);
  const [noCoverage, setNoCoverage] = useState(false);
  const [excludedFull, setExcludedFull] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [pendingHeure, setPendingHeure] = useState<{ date: string; heure: string; status: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);

  const now0 = new Date();
  const currentMonthLabel = buildMonthLabel(now0.getFullYear(), now0.getMonth() + 1);
  const [month, setMonth] = useState(currentMonthLabel);
  const [pastRows, setPastRows] = useState<Rdv[]>([]);
  const [pastSelectedDay, setPastSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/parametres', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        setDepartements(j.data?.departements || []);
        setChampsAgent(j.data?.champs_prise_rdv_agent || []);
        const closed: string[] = j.data?.operations_fermees || [];
        setOperationsList((j.data?.operations || []).filter((o: string) => !closed.includes(o)));
      });
    loadMine();
  }, []);

  async function loadMine() {
    const res = await fetch('/api/rdv-requests/mine', { cache: 'no-store' });
    const json = await res.json();
    setMyRequests(json.data || []);
  }

  const regionCode = departement ? regionCodeForDept(extractDeptCode(departement)) : null;
  const region = regionCode ? REGIONS[regionCode] : null;

  const isPastMonth = (() => {
    const m = month.match(/^(\S+)\s+(\d{4})$/);
    if (!m) return false;
    const moisNoms = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    const idx = moisNoms.indexOf(m[1]);
    const year = parseInt(m[2], 10);
    if (idx < 0) return false;
    if (year !== now0.getFullYear()) return year < now0.getFullYear();
    return idx < now0.getMonth();
  })();

  useEffect(() => {
    if (!isPastMonth) { setPastRows([]); return; }
    fetch(`/api/rdv?month=${encodeURIComponent(month)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setPastRows(j.data || []));
    setPastSelectedDay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isPastMonth]);

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
    setConfirmed(false);
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
    const extra: Record<string, string> = {};
    for (const champ of champsAgent) {
      const key = FIELD_KEY_MAP[champ];
      if (key && clientFields[champ]) extra[key] = clientFields[champ];
    }
    try {
      const res = await fetch('/api/disponibilites/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: pendingHeure.date, heure: pendingHeure.heure, code_postal: cp, departement, slot_status: pendingHeure.status, ...extra }),
      });
      let json: any = {};
      try {
        json = await res.json();
      } catch {
        throw new Error(`Reponse inattendue du serveur (code ${res.status}). Reessaie, et previens le gestionnaire si ca continue.`);
      }
      setBooking(false);
      if (!res.ok) {
        setError(json.error || `Erreur lors de la demande (code ${res.status}).`);
        setPendingHeure(null);
        search();
        return;
      }
      setConfirmed(true);
      setPendingHeure(null);
      loadMine();
    } catch (e: any) {
      setBooking(false);
      setError(e?.message || 'Erreur reseau : la demande n\'a pas pu etre envoyee. Verifie ta connexion et reessaie.');
    }
  }

  async function cancelRequest(id: string) {
    if (!confirm('Annuler cette demande ?')) return;
    await fetch(`/api/rdv-requests/${id}`, { method: 'DELETE' });
    loadMine();
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

  // read-only past-month calendar grid
  const parsedPast = parseMonthLabel(month);
  const pastGrid = useMemo(() => {
    if (!parsedPast) return [];
    const first = new Date(Date.UTC(parsedPast.year, parsedPast.monthNum - 1, 1));
    const lastDate = new Date(Date.UTC(parsedPast.year, parsedPast.monthNum, 0)).getUTCDate();
    const startDow = (first.getUTCDay() + 6) % 7;
    const cells: (string | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= lastDate; d++) {
      cells.push(`${parsedPast.year}-${String(parsedPast.monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [parsedPast]);

  function pastRdvsForDay(dateStr: string) {
    return pastRows.filter((r) => r.date && r.date.slice(0, 10) === dateStr);
  }

  return (
    <div className="max-w-3xl">
      {(confirmed || error) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md">
          {confirmed && (
            <div className="bg-statut-honore text-white rounded-lg shadow-xl p-4 text-sm font-medium flex items-start justify-between gap-3">
              <span>✓ Demande envoyee ! Elle apparaitra dans "Mes demandes" une fois traitee par le gestionnaire.</span>
              <button onClick={() => setConfirmed(false)} className="shrink-0 opacity-80 hover:opacity-100">×</button>
            </div>
          )}
          {!confirmed && error && (
            <div className="bg-statut-annule text-white rounded-lg shadow-xl p-4 text-sm font-medium flex items-start justify-between gap-3">
              <span>{error}</span>
              <button onClick={() => setError('')} className="shrink-0 opacity-80 hover:opacity-100">×</button>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-ink">Prise de RDV</h1>
        <a href="/carte" className="text-forest text-sm underline">Voir la carte de France →</a>
      </div>
      <p className="text-ink/60 text-sm mb-6">
        Choisis le departement du client : le jour le plus proche geographiquement (RDV existant
        ou commercial disponible) est propose en premier. Ta demande sera validee par le
        gestionnaire.
      </p>

      <div className="bg-white rounded-lg border border-black/5 p-4 mb-4">
        <label className="block text-sm font-medium text-ink mb-1">Departement du client</label>
        <div className="flex gap-2">
          <input
            list="departements-suggestions"
            value={departement}
            onChange={(e) => setDepartement(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Tape le nom ou le numero..."
            className="flex-1 border border-black/10 rounded-md px-3 py-2 text-sm"
          />
          <datalist id="departements-suggestions">
            {departements.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium text-ink/50 mb-0.5">Region</label>
          <input
            readOnly
            value={region || ''}
            placeholder="Se remplit automatiquement"
            className="w-full border border-black/5 rounded-md px-3 py-1.5 text-sm bg-ink/5 text-ink/60"
          />
        </div>
        {champsAgent.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {champsAgent.map((champ) =>
              champ === 'Operation' ? (
                <select
                  key={champ}
                  value={clientFields[champ] || ''}
                  onChange={(e) => setClientFields((f) => ({ ...f, [champ]: e.target.value }))}
                  className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Operation —</option>
                  {operationsList.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  key={champ}
                  value={clientFields[champ] || ''}
                  onChange={(e) => setClientFields((f) => ({ ...f, [champ]: e.target.value }))}
                  placeholder={champ}
                  className="border border-black/10 rounded-md px-3 py-2 text-sm"
                />
              )
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-black/5">
          <label className="block text-sm font-medium text-ink mb-1">Mois</label>
          <div className="flex items-center gap-2">
            <MonthYearPicker value={month} onChange={setMonth} />
            {!isPastMonth && (
              <button
                onClick={search}
                disabled={loading}
                className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? 'Recherche...' : 'Chercher'}
              </button>
            )}
          </div>
          {isPastMonth && (
            <p className="text-xs text-gold mt-2">
              Mois passe : consultation uniquement, calendrier des RDV existants ci-dessous.
            </p>
          )}
        </div>
        {error && <p className="text-statut-annule text-xs mt-2">{error}</p>}
      </div>

      {isPastMonth ? (
        <div className="bg-white rounded-xl border border-black/5 p-5 mb-6">
          <div className="grid grid-cols-7 gap-2 mb-2 text-xs font-semibold text-ink/40 text-center uppercase tracking-wide">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {pastGrid.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const dayNum = parseInt(dateStr.slice(-2), 10);
              const dayRdvs = pastRdvsForDay(dateStr);
              const hasRdv = dayRdvs.length > 0;
              const isSelected = pastSelectedDay === dateStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => setPastSelectedDay(dateStr === pastSelectedDay ? null : dateStr)}
                  className={`aspect-square rounded-lg border p-2 flex flex-col text-left ${hasRdv ? 'bg-forest-light border-forest/20' : 'bg-white border-black/10'} ${isSelected ? 'ring-2 ring-forest' : ''}`}
                >
                  <span className="text-xs font-semibold text-ink/70">{dayNum}</span>
                  {hasRdv && <span className="text-lg font-bold text-forest">{dayRdvs.length}</span>}
                </button>
              );
            })}
          </div>
          {pastSelectedDay && (
            <div className="mt-3 space-y-1.5">
              {pastRdvsForDay(pastSelectedDay).map((r) => (
                <div key={r.id} className="text-xs bg-forest-light/40 rounded px-2 py-1.5">
                  {r.heure || '—'} · {r.raison_sociale || r.client || 'Client non precise'} · {r.statut || 'Confirme'}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {noCoverage && searched && (
            <div className="bg-blue-100 text-blue-800 rounded-md p-3 mb-4 text-sm">
              ⚠️ Aucun commercial ne couvre cette zone actuellement. Les jours ci-dessous
              necessiteront de preparer un commercial specifiquement.
            </div>
          )}
          {excludedFull.length > 0 && searched && (
            <div className="bg-orange-100 text-orange-800 rounded-md p-3 mb-4 text-sm">
              ⚠️ {excludedFull.length} jour(s) auraient ete un bon choix mais sont deja complets
              (max de RDV atteint). Un depassement manuel reste possible depuis Planning.
            </div>
          )}

          {loading && <p className="text-sm text-ink/40">Calcul des disponibilites en cours (ca peut prendre quelques secondes)...</p>}
          {!loading && searched && orderedDates.length === 0 && (
            <p className="text-sm text-ink/40">Aucune disponibilite trouvee.</p>
          )}

          {orderedDates.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
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
                <div className="mt-3 bg-forest-light border border-forest/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <span className="text-lg leading-none">💡</span>
                  <p className="text-sm font-bold text-forest-dark">
                    Privilegie en priorite le vert, puis l'orange, puis le bleu.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-black/5 p-4">
                <h3 className="text-sm font-semibold text-ink mb-2">
                  {selectedDay
                    ? new Date(selectedDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                    : 'Choisis un jour colore'}
                </h3>
                {!selectedDay && (
                  <p className="text-xs text-ink/40">Les jours colores dans le calendrier ont des creneaux disponibles.</p>
                )}
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

          {myRequests.length > 0 && (
            <div className="bg-white rounded-lg border border-black/5 p-4">
              <h2 className="text-sm font-semibold text-ink mb-2">Mes demandes</h2>
              <div className="space-y-1.5">
                {myRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-forest-light/30 rounded-md px-3 py-2">
                    <span>{new Date(r.date).toLocaleDateString('fr-FR')} · {r.heure}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.status === 'pending' && (
                        <button onClick={() => cancelRequest(r.id)} className="text-statut-annule text-xs hover:underline">
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {pendingHeure && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => !booking && setPendingHeure(null)}>
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
  );
}
