'use client';

import { useEffect, useState } from 'react';

const PALETTE = [
  { value: '', label: '-- aucune couleur --' },
  { value: 'green', label: '🟢 Vert' },
  { value: 'blue', label: '🔵 Bleu' },
  { value: 'red', label: '🔴 Rouge' },
  { value: 'orange', label: '🟠 Orange' },
  { value: 'purple', label: '🟣 Violet' },
  { value: 'yellow', label: '🟡 Jaune' },
  { value: 'gray', label: '⚪ Gris' },
  { value: 'pink', label: '🩷 Rose' },
  { value: 'teal', label: '🟦 Turquoise' },
  { value: 'indigo', label: '🔵 Indigo' },
  { value: 'amber', label: '🟤 Ambre' },
  { value: 'black', label: '⚫ Noir' },
];

export default function SousStatutCouleursSection({ sousStatuts }: { sousStatuts: string[] }) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  useEffect(() => {
    fetch('/api/parametres', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const raw: string[] = j.data?.couleurs_sous_statuts || [];
        const m: Record<string, string> = {};
        for (const entry of raw) {
          const [sousStatut, couleur] = entry.split('=');
          if (sousStatut && couleur) m[sousStatut] = couleur;
        }
        setMapping(m);
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSavedFlag(false);
    const values = Object.entries(mapping)
      .filter(([, couleur]) => couleur)
      .map(([sousStatut, couleur]) => `${sousStatut}=${couleur}`);
    await fetch('/api/parametres', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'couleurs_sous_statuts', values }),
    });
    setSaving(false);
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  }

  return (
    <div className="bg-white rounded-lg border border-black/5 p-4">
      <h2 className="font-semibold text-ink mb-1">Couleurs des sous-statuts (page Planning)</h2>
      <p className="text-xs text-ink/50 mb-3">
        Colore la ligne entiere d'un RDV dans "Visites realisees" selon son sous-statut (Devis
        signe, KO...). Choisis "aucune couleur" pour laisser la ligne neutre.
      </p>

      {loading && <p className="text-sm text-ink/40">Chargement...</p>}
      {!loading && sousStatuts.length === 0 && <p className="text-sm text-ink/40 italic">Aucun sous-statut defini.</p>}

      {!loading && (
        <div className="space-y-2 mb-3">
          {sousStatuts.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="w-40 text-sm font-medium truncate">{s}</span>
              <select
                value={mapping[s] || ''}
                onChange={(e) => setMapping((m) => ({ ...m, [s]: e.target.value }))}
                className="flex-1 border border-black/10 rounded-md px-3 py-1.5 text-sm bg-white"
              >
                {PALETTE.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : savedFlag ? '✓ Enregistre' : 'Enregistrer'}
      </button>
    </div>
  );
}
