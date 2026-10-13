'use client';

import { useState } from 'react';

interface PreviewResult {
  rows: any[];
  summary: Record<string, { total: number; parWeek: Record<number, number>; parCouleur: Record<string, number> }>;
  skippedSheets: string[];
  feriesSkipped: number;
}

export default function ImportSection({ onImported }: { onImported?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'add' | 'replace'>('add');

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError('');
    setPreview(null);
    setDone(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import/preview', { method: 'POST', body: fd });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Erreur lors de l'analyse du fichier.");
      return;
    }
    setPreview(json);
  }

  async function confirmImport() {
    if (!preview) return;
    if (mode === 'replace') {
      const months = Object.keys(preview.summary);
      const ok = confirm(
        `Ceci va SUPPRIMER les RDV deja enregistres pour ${months.join(', ')} avant d'importer ` +
        `les nouveaux. Cette action est irreversible. Continuer ?`
      );
      if (!ok) return;
    }
    setConfirming(true);
    setError('');
    const res = await fetch('/api/import/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview.rows, mode, filename: file?.name }),
    });
    const json = await res.json();
    setConfirming(false);
    if (!res.ok) {
      setError(json.error || "Erreur lors de l'import.");
      return;
    }
    setDone(json.inserted);
    onImported?.();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-1">Importer un fichier Excel</h2>
      <p className="text-ink/60 text-sm mb-6">
        Depose un ancien fichier planning (.xlsx). Les statuts en couleur sont importes sous
        forme de nom de couleur (Vert, Rose, Rouge, Orange, Jaune) — tu pourras les renommer
        ensuite dans le Planning pour remettre le vrai statut (Honore, Annule...). Les cases
        marquees "ferie" sont ignorees automatiquement.
      </p>

      <div className="bg-white rounded-lg border border-black/5 p-5 mb-6">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setDone(null); }}
          className="block w-full text-sm mb-3"
        />
        <button
          onClick={analyze}
          disabled={!file || loading}
          className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? 'Analyse...' : 'Analyser le fichier'}
        </button>
      </div>

      {error && (
        <div className="bg-statut-annule/10 text-statut-annule rounded-md p-3 mb-4 text-sm">{error}</div>
      )}

      {preview && (
        <div className="bg-white rounded-lg border border-black/5 p-5 mb-6">
          <h2 className="font-semibold text-ink mb-3">Apercu avant import</h2>

          {preview.skippedSheets.length > 0 && (
            <p className="text-xs text-ink/50 mb-2">
              Feuilles ignorees (nom non reconnu comme mois) : {preview.skippedSheets.join(', ')}
            </p>
          )}
          {preview.feriesSkipped > 0 && (
            <p className="text-xs text-ink/50 mb-3">
              {preview.feriesSkipped} case(s) "ferie" ignoree(s) (pas de vrai RDV).
            </p>
          )}

          <div className="space-y-3 mb-4">
            {Object.entries(preview.summary).map(([month, s]) => (
              <div key={month} className="border border-black/10 rounded-md p-3">
                <div className="font-medium text-ink mb-1">{month} — {s.total} RDV</div>
                <div className="text-xs text-ink/60 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Par semaine : {Object.entries(s.parWeek).map(([w, n]) => `S${w}: ${n}`).join(' · ')}</span>
                </div>
                <div className="text-xs text-ink/60 mt-1">
                  Par couleur : {Object.entries(s.parCouleur).map(([c, n]) => `${c}: ${n}`).join(' · ')}
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-ink mb-3">
            Total : <span className="font-semibold">{preview.rows.length}</span> RDV a traiter.
          </p>

          <div className="flex gap-4 mb-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'add'} onChange={() => setMode('add')} />
              Ajouter (garde les RDV existants, ajoute ceux-ci en plus)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              Remplacer (supprime d'abord les RDV existants des mois concernes)
            </label>
          </div>

          {done === null ? (
            <button
              onClick={confirmImport}
              disabled={confirming}
              className="bg-gold hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
            >
              {confirming ? 'Import en cours...' : `Confirmer l'import de ${preview.rows.length} RDV`}
            </button>
          ) : (
            <div className="bg-statut-honore/10 text-statut-honore rounded-md p-3 text-sm">
              {done} RDV importes avec succes. Va sur le{' '}
              <a href="/planning" className="underline font-medium">Planning</a> pour les voir.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
