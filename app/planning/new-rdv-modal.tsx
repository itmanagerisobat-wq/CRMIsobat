'use client';

import { useEffect, useState } from 'react';
import { isWeekend, isFrenchHoliday } from '@/lib/holidays';
import { useUnivers } from '@/lib/use-univers';

interface Props {
  month: string;
  week: number;
  params: Record<string, string[]>;
  onClose: () => void;
  onSaved: () => void;
}

const inp = 'w-full border border-black/10 rounded-md px-3 py-2 text-sm';

export default function NewRdvModal({ month, week, params, onClose, onSaved }: Props) {
  const univers = useUnivers();
  const [form, setForm] = useState({
    date: '', heure: '', operation: '', raison_sociale: '', client: '', fonction_responsable: '',
    telephone: '', departement: '', code_postal: '', adresse: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [doublon, setDoublon] = useState<{ sameCount: number; sameOperation: any } | null>(null);
  const [forceCreate, setForceCreate] = useState(false);
  const [dayLoad, setDayLoad] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'raison_sociale' || key === 'operation') setForceCreate(false);
  }

  useEffect(() => {
    const rs = form.raison_sociale.trim();
    if (!rs) { setDoublon(null); return; }
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({ raison_sociale: rs, operation: form.operation });
      const res = await fetch(`/api/rdv/check-doublon?${qs.toString()}`);
      if (res.ok) setDoublon(await res.json());
    }, 500);
    return () => clearTimeout(t);
  }, [form.raison_sociale, form.operation]);

  useEffect(() => {
    if (!form.date) { setDayLoad(null); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/rdv?date=${encodeURIComponent(form.date)}`, { cache: 'no-store' }).catch(() => null);
      if (res && res.ok) {
        const j = await res.json();
        setDayLoad((j.data || []).length);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.date]);

  useEffect(() => {
    const cp = form.code_postal.trim();
    if (cp.length < 4) return;
    const t = setTimeout(async () => {
      setDistanceLoading(true);
      const res = await fetch(`/api/distance?cp=${encodeURIComponent(cp)}`);
      setDistanceLoading(false);
      if (res.ok) setDistanceKm((await res.json()).km);
    }, 700);
    return () => clearTimeout(t);
  }, [form.code_postal]);

  let dateClass = 'bg-white';
  if (form.date) {
    if (isWeekend(form.date) || isFrenchHoliday(form.date)) dateClass = 'bg-ink/10';
    else if (dayLoad != null && dayLoad >= 3) dateClass = 'bg-orange-100';
    else if (dayLoad != null && dayLoad > 0) dateClass = 'bg-statut-honore/10';
  }

  const hasBlockingDoublon = doublon?.sameOperation && !forceCreate;

  async function save() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/rdv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, distance_paris_km: distanceKm, month, week_number: week, type_client: univers }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erreur lors de la sauvegarde.');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-ink text-lg">Nouveau RDV</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/50 mb-4">
          Juste les infos de base pour l'instant. La qualite, l'affectation et le reste se
          rempliront aux etapes suivantes du dossier.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={`${inp} ${dateClass}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Heure</label>
            <input
              type="text"
              value={form.heure}
              onChange={(e) => set('heure', e.target.value)}
              placeholder="ex: 9h30"
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Operation</label>
            <select value={form.operation} onChange={(e) => set('operation', e.target.value)} className={inp}>
              <option value="">—</option>
              {(params.operations || []).filter((o) => !(params.operations_fermees || []).includes(o)).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Departement</label>
            <select value={form.departement} onChange={(e) => set('departement', e.target.value)} className={inp}>
              <option value="">—</option>
              {(params.departements || []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Code postal</label>
            <input value={form.code_postal} onChange={(e) => set('code_postal', e.target.value)} className={inp} />
            {distanceLoading && <p className="text-[11px] text-ink/40 mt-0.5">Calcul distance...</p>}
            {!distanceLoading && distanceKm != null && <p className="text-[11px] text-forest mt-0.5">{distanceKm} km de Paris</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Adresse</label>
            <input value={form.adresse} onChange={(e) => set('adresse', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Raison sociale</label>
            <input value={form.raison_sociale} onChange={(e) => set('raison_sociale', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Responsable</label>
            <input value={form.client} onChange={(e) => set('client', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Fonction du responsable</label>
            <input value={form.fonction_responsable} onChange={(e) => set('fonction_responsable', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Telephone</label>
            <input type="tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} className={inp} />
          </div>
        </div>

        {doublon && doublon.sameCount > 0 && !doublon.sameOperation && (
          <p className="text-xs text-gold bg-gold-light/60 rounded px-3 py-2 mb-2">
            Cette raison sociale a deja {doublon.sameCount} RDV enregistre(s).
          </p>
        )}
        {doublon?.sameOperation && (
          <div className="text-xs bg-statut-annule/10 text-statut-annule rounded px-3 py-2 mb-2 flex items-center justify-between flex-wrap gap-2">
            <span>⚠️ <strong>{form.raison_sociale}</strong> a deja un RDV pour cette operation.</span>
            <button onClick={() => setForceCreate(true)} className="bg-statut-annule text-white px-2 py-1 rounded font-medium">Creer quand meme</button>
          </div>
        )}
        {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !!hasBlockingDoublon}
            className="flex-1 bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-40"
          >
            {saving ? 'Enregistrement...' : 'Creer le dossier'}
          </button>
          <button onClick={onClose} disabled={saving} className="flex-1 bg-white border border-black/10 text-ink text-sm font-medium py-2 rounded-md">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
