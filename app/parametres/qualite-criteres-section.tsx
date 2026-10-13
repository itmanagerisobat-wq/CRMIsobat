'use client';

import { useEffect, useState } from 'react';

interface Critere {
  id: string;
  operation: string;
  critere: string;
}

export default function QualiteCriteresSection({ operations }: { operations: string[] }) {
  const [selectedOp, setSelectedOp] = useState('');
  const [criteres, setCriteres] = useState<Critere[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCritere, setNewCritere] = useState('');
  const [adding, setAdding] = useState(false);

  async function load(op: string) {
    if (!op) { setCriteres([]); return; }
    setLoading(true);
    const res = await fetch(`/api/qualite-criteres?operation=${encodeURIComponent(op)}`, { cache: 'no-store' });
    const json = await res.json();
    setCriteres(json.data || []);
    setLoading(false);
  }

  useEffect(() => { load(selectedOp); }, [selectedOp]);

  async function addCritere() {
    if (!newCritere.trim() || !selectedOp) return;
    setAdding(true);
    await fetch('/api/qualite-criteres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: selectedOp, critere: newCritere }),
    });
    setNewCritere('');
    setAdding(false);
    load(selectedOp);
  }

  async function removeCritere(id: string) {
    await fetch(`/api/qualite-criteres/${id}`, { method: 'DELETE' });
    load(selectedOp);
  }

  return (
    <div className="bg-white rounded-lg border border-black/5 p-4">
      <h2 className="font-semibold text-ink mb-1">Criteres de qualite par operation</h2>
      <p className="text-xs text-ink/50 mb-3">
        Utilises dans la phase "Qualite RDV" du dossier. Chaque operation peut avoir sa propre
        liste, modifiable a tout moment.
      </p>

      <select
        value={selectedOp}
        onChange={(e) => setSelectedOp(e.target.value)}
        className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white mb-3 w-full sm:w-auto"
      >
        <option value="">-- choisir une operation --</option>
        {operations.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>

      {selectedOp && (
        <>
          <div className="flex gap-2 mb-3">
            <input
              value={newCritere}
              onChange={(e) => setNewCritere(e.target.value)}
              placeholder="Nouveau critere..."
              className="flex-1 border border-black/10 rounded-md px-3 py-1.5 text-sm"
            />
            <button
              onClick={addCritere}
              disabled={adding}
              className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-3 rounded-md disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
          {loading && <p className="text-sm text-ink/40">Chargement...</p>}
          <ul className="divide-y divide-black/5">
            {criteres.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                <span>{c.critere}</span>
                <button onClick={() => removeCritere(c.id)} className="text-statut-annule text-xs hover:underline">
                  Supprimer
                </button>
              </li>
            ))}
            {!loading && criteres.length === 0 && (
              <li className="text-xs text-ink/40 italic py-1.5">Aucun critere pour cette operation.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
