'use client';

import { useEffect, useState } from 'react';
import { Rdv } from '@/lib/types';

interface Props {
  rdv: Rdv;
  params: Record<string, string[]>;
  onClose: () => void;
  onSaved: () => void;
}

export default function CommercialPopup({ rdv, params, onClose, onSaved }: Props) {
  const [commercial, setCommercial] = useState(rdv.commercial || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<{ commercialConflict: Rdv | null } | null>(null);
  const [forceConflict, setForceConflict] = useState(false);

  useEffect(() => {
    if (!rdv.date || !rdv.heure || !commercial) { setConflict(null); return; }
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({ date: rdv.date!, heure: rdv.heure!, commercial });
      qs.set('exclude_id', rdv.id);
      const res = await fetch(`/api/rdv/check-conflit?${qs.toString()}`);
      if (res.ok) setConflict(await res.json());
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commercial]);

  const hasConflict = conflict?.commercialConflict && !forceConflict;

  async function save() {
    if (hasConflict) return;
    setSaving(true);
    setError('');
    const res = await fetch(`/api/rdv/${rdv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commercial }),
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
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xs p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-lg">Commercial</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/50 mb-3">
          {rdv.raison_sociale || rdv.client || 'Client non precise'} · {rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR') : '—'} {rdv.heure}
        </p>
        <select
          value={commercial}
          onChange={(e) => { setCommercial(e.target.value); setForceConflict(false); }}
          className="w-full border border-black/10 rounded-md px-3 py-2 text-sm mb-3"
        >
          <option value="">—</option>
          {((rdv.type_client === 'b2c' ? params.commerciaux_b2c : params.commerciaux) || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {conflict?.commercialConflict && (
          <div className="text-xs bg-statut-annule/10 text-statut-annule rounded px-3 py-2 mb-3">
            <p className="mb-1">⚠️ <strong>{commercial}</strong> a deja un RDV a {rdv.heure} le {rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR') : ''}.</p>
            <button onClick={() => setForceConflict(true)} className="bg-statut-annule text-white px-2 py-1 rounded font-medium">
              Affecter quand meme
            </button>
          </div>
        )}
        {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-3">{error}</p>}
        <button
          onClick={save}
          disabled={saving || !commercial || !!hasConflict}
          className="w-full bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-40"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
