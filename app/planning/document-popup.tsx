'use client';

import { useState } from 'react';
import { Rdv } from '@/lib/types';

interface Props {
  rdv: Rdv;
  params: Record<string, string[]>;
  onClose: () => void;
  onSaved: () => void;
}

const inp = 'w-full border border-black/10 rounded-md px-3 py-2 text-sm';

export default function DocumentPopup({ rdv, params, onClose, onSaved }: Props) {
  const [statut, setStatut] = useState(rdv.document_statut || '');
  const [note, setNote] = useState(rdv.document_note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/rdv/${rdv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_statut: statut || null, document_note: note || null }),
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
          <h2 className="font-semibold text-ink text-lg">📄 Document</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/50 mb-3">
          {rdv.raison_sociale || rdv.client || 'Client non precise'} · {rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR') : '—'}
        </p>

        <label className="block text-xs font-medium text-ink/60 mb-1">Statut</label>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inp} mb-3`}>
          <option value="">-- aucun --</option>
          {(params.documents_statuts || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <label className="block text-xs font-medium text-ink/60 mb-1">Precision (quel document, quelle info...)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="ex: RIB manquant, attend le devis signe..." className={`${inp} resize-none`} />

        {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 my-3">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-40 mt-3"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
