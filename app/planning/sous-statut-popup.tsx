'use client';

import { useEffect, useState } from 'react';
import { Rdv } from '@/lib/types';
import { textIncludes } from '@/lib/text-match';

interface Props {
  rdv: Rdv;
  params: Record<string, string[]>;
  onClose: () => void;
  onSaved: () => void;
}

const inp = 'w-full border border-black/10 rounded-md px-3 py-2 text-sm';

export default function SousStatutPopup({ rdv, params, onClose, onSaved }: Props) {
  const [sousStatut, setSousStatut] = useState(rdv.sous_statut || '');
  const [compteRendu, setCompteRendu] = useState(rdv.compte_rendu || '');
  const [nouvelleDate, setNouvelleDate] = useState(rdv.date || '');
  const [nouvelleHeure, setNouvelleHeure] = useState(rdv.heure || '');
  const isReporte = textIncludes(sousStatut, 'reporte');
  const isDevisEnvoye = textIncludes(sousStatut, 'devis envoy');
  const [devisFile, setDevisFile] = useState<File | null>(null);
  const [nddFile, setNddFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<{ id: string; kind: string; filename: string }[]>([]);
  useEffect(() => {
    fetch(`/api/rdv-files?rdv_id=${rdv.id}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => setExisting(j.data || [])).catch(() => {});
  }, [rdv.id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (isReporte && (!nouvelleDate || nouvelleDate === (rdv.date || ''))) {
      setError('Statut reporte : indique la nouvelle date du RDV.');
      return;
    }
    setSaving(true);
    const payload: Record<string, string> = { sous_statut: sousStatut, compte_rendu: compteRendu };
    if (isReporte) { payload.date = nouvelleDate; if (nouvelleHeure) payload.heure = nouvelleHeure; }
    const res = await fetch(`/api/rdv/${rdv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSaving(false);
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erreur lors de la sauvegarde.');
      return;
    }
    if (isDevisEnvoye) {
      for (const [kind, file] of [['devis', devisFile], ['ndd', nddFile]] as const) {
        if (!file) continue;
        const fd = new FormData();
        fd.append('rdv_id', rdv.id);
        fd.append('kind', kind);
        fd.append('file', file);
        const up = await fetch('/api/rdv-files', { method: 'POST', body: fd });
        if (!up.ok) {
          const j = await up.json().catch(() => ({}));
          setSaving(false);
          setError(`Statut enregistre, mais ${kind === 'devis' ? 'le devis' : 'le NDD'} n'a pas pu etre envoye : ${j.error || 'erreur'}`);
          return;
        }
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-lg">Sous-statut</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/50 mb-3">
          {rdv.raison_sociale || rdv.client || 'Client non precise'} · {rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR') : '—'} {rdv.heure}
        </p>

        <label className="block text-xs font-medium text-ink/60 mb-1">Sous-statut</label>
        <select value={sousStatut} onChange={(e) => setSousStatut(e.target.value)} className={`${inp} mb-3`}>
          <option value="">—</option>
          {(params.sous_statuts || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {isReporte && (
          <div className="grid grid-cols-2 gap-2 mb-3 bg-gold/10 border border-gold/40 rounded-md p-2">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Nouvelle date (Reporte)</label>
              <input type="date" value={nouvelleDate} onChange={(e) => setNouvelleDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Heure</label>
              <input type="time" value={nouvelleHeure} onChange={(e) => setNouvelleHeure(e.target.value)} className={inp} />
            </div>
          </div>
        )}

        {isDevisEnvoye && (
          <div className="mb-3 bg-forest-light/50 border border-forest/20 rounded-md p-2 space-y-2">
            <div className="text-xs font-semibold text-forest-dark">📎 Pieces jointes (visibles par le relanceur)</div>
            {(['devis', 'ndd'] as const).map((kind) => {
              const cur = existing.find((f) => f.kind === kind);
              return (
                <div key={kind}>
                  <label className="block text-xs font-medium text-ink/60 mb-1">
                    {kind === 'devis' ? 'Devis envoye' : 'NDD (si existant)'}
                    {cur && <> — actuel : <a href={`/api/rdv-files/${cur.id}`} target="_blank" rel="noreferrer" className="text-forest underline">{cur.filename}</a></>}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => (kind === 'devis' ? setDevisFile : setNddFile)(e.target.files?.[0] || null)}
                    className="w-full text-xs"
                  />
                </div>
              );
            })}
            <p className="text-[11px] text-ink/40">Max 4 Mo par fichier. Un nouveau fichier remplace l'ancien.</p>
          </div>
        )}

        <label className="block text-xs font-medium text-ink/60 mb-1">Compte-rendu / echange avec le client</label>
        <textarea value={compteRendu} onChange={(e) => setCompteRendu(e.target.value)} rows={3} className={`${inp} resize-none`} />

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
