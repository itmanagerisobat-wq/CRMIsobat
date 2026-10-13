'use client';

import { useEffect, useState } from 'react';

const KNOWN_COLORS = ['Vert', 'Vert clair', 'Rose', 'Rouge', 'Orange', 'Jaune', 'Bleu', 'Bleu clair', 'Violet'];

export default function CouleursImportSection() {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [statutOptions, setStatutOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  useEffect(() => {
    fetch('/api/parametres', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const raw: string[] = j.data?.correspondance_couleurs_import || [];
        const m: Record<string, string> = {};
        for (const entry of raw) {
          const [couleur, statut] = entry.split('=');
          if (couleur && statut) m[couleur] = statut;
        }
        setMapping(m);
        setStatutOptions(j.data?.statuts_import_couleur || []);
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSavedFlag(false);
    const values = Object.entries(mapping)
      .filter(([, statut]) => statut)
      .map(([couleur, statut]) => `${couleur}=${statut}`);
    await fetch('/api/parametres', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'correspondance_couleurs_import', values }),
    });
    setSaving(false);
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  }

  return (
    <div className="bg-white rounded-lg border border-black/5 p-4">
      <h2 className="font-semibold text-ink mb-1">Correspondance couleurs → statuts (import Excel)</h2>
      <p className="text-xs text-ink/50 mb-3">
        Les anciens fichiers Excel codent le statut par une couleur de cellule. Associe chaque
        couleur detectee a un vrai statut : les prochains imports appliqueront directement le
        statut, sans passer par la couleur. Le statut que tu cherches n'est pas dans la liste ?
        Ajoute-le dans "Statuts possibles pour la correspondance couleurs" plus bas dans cette
        page.
      </p>

      {loading && <p className="text-sm text-ink/40">Chargement...</p>}

      {!loading && (
        <div className="space-y-2 mb-3">
          {KNOWN_COLORS.map((couleur) => (
            <div key={couleur} className="flex items-center gap-2">
              <span className="w-28 text-sm font-medium">{couleur}</span>
              <select
                value={mapping[couleur] || ''}
                onChange={(e) => setMapping((m) => ({ ...m, [couleur]: e.target.value }))}
                className="flex-1 border border-black/10 rounded-md px-3 py-1.5 text-sm bg-white"
              >
                <option value="">-- non mappe (garde le nom de couleur) --</option>
                {statutOptions.map((s) => <option key={s} value={s}>{s}</option>)}
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
