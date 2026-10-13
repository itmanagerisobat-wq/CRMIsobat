'use client';

import { useState } from 'react';
import { Rdv, CORE_STATUTS } from '@/lib/types';
import { textIncludes } from '@/lib/text-match';

interface Props {
  rdv: Rdv;
  params: Record<string, string[]>;
  onClose: () => void;
  onSaved: () => void;
}

const inp = 'w-full border border-black/10 rounded-md px-3 py-2 text-sm';

export default function StatutPopup({ rdv, params, onClose, onSaved }: Props) {
  const [statut, setStatut] = useState(rdv.statut || '');
  const [motif, setMotif] = useState(rdv.motif || '');
  const [nouvelleDate, setNouvelleDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const statutOptions = params.statuts_visite && params.statuts_visite.length > 0 ? params.statuts_visite : CORE_STATUTS;
  const showNouvelleDate = textIncludes(statut, 'reporte');
  const isHonore = statut === 'honore';
  const blockedNoCommercial = isHonore && !rdv.commercial;

  async function save() {
    if (blockedNoCommercial) return;
    setSaving(true);
    setError('');
    const payload: Record<string, any> = { statut, motif };
    if (showNouvelleDate && nouvelleDate) payload.date = nouvelleDate;
    const res = await fetch(`/api/rdv/${rdv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-lg">Statut</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/50 mb-3">
          {rdv.raison_sociale || rdv.client || 'Client non precise'} · {rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR') : '—'} {rdv.heure}
        </p>

        <label className="block text-xs font-medium text-ink/60 mb-1">Statut de la visite</label>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inp} mb-3`}>
          <option value="">—</option>
          {statutOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="text-[11px] text-ink/40 mb-3 -mt-2">
          Si "Honore", le RDV descend automatiquement dans "Visites realisees" ou tu renseigneras le sous-statut.
        </p>

        <label className="block text-xs font-medium text-ink/60 mb-1">Commentaire</label>
        <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={`${inp} resize-none mb-3`} />

        {showNouvelleDate && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-ink/60 mb-1">Nouvelle date demandee</label>
            <input type="date" value={nouvelleDate} onChange={(e) => setNouvelleDate(e.target.value)} className={inp} />
          </div>
        )}

        {blockedNoCommercial && (
          <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-3">
            ⚠️ Affecte d'abord un commercial avant de pouvoir passer ce RDV en "Honore".
          </p>
        )}
        {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-3">{error}</p>}

        <button
          onClick={save}
          disabled={saving || !statut || blockedNoCommercial}
          className="w-full bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-40"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
