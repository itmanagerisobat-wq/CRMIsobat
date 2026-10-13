'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';
import ImportSection from './import-section';
import MonthYearPicker from '../month-year-picker';

interface AutoBackup {
  id: string;
  created_at: string;
}

interface ImportBatch {
  id: string;
  filename: string | null;
  row_count: number;
  months: string[];
  created_at: string;
}

export default function BackupPage() {
  const role = useRole();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [autoBackups, setAutoBackups] = useState<AutoBackup[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [dangerPassword, setDangerPassword] = useState('');
  const [dangerConfirming, setDangerConfirming] = useState(false);
  const [dangerError, setDangerError] = useState('');
  const [showDangerZone, setShowDangerZone] = useState(false);
  const now = new Date();
  const [deleteMonth, setDeleteMonth] = useState(`${['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'][now.getMonth()]} ${now.getFullYear()}`);
  const [deleteMonthPassword, setDeleteMonthPassword] = useState('');
  const [deleteMonthConfirming, setDeleteMonthConfirming] = useState(false);
  const [deleteMonthError, setDeleteMonthError] = useState('');

  async function loadBatches() {
    setLoadingBatches(true);
    const res = await fetch('/api/import/batches', { cache: 'no-store' });
    const json = await res.json();
    setBatches(json.data || []);
    setLoadingBatches(false);
  }

  useEffect(() => { loadBatches(); }, []);

  async function deleteBatch(id: string, filename: string | null) {
    if (!confirm(`Supprimer l'import "${filename || 'sans nom'}" et tous ses RDV ? Action irreversible.`)) return;
    setDeletingBatchId(id);
    const res = await fetch(`/api/import/batches/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setDeletingBatchId(null);
    if (!res.ok) {
      alert(json.error || 'Erreur lors de la suppression.');
      return;
    }
    alert(`${json.deleted} RDV supprimes.`);
    loadBatches();
  }

  async function deleteAllData() {
    if (!dangerPassword) return;
    if (!confirm('DERNIERE CONFIRMATION : ceci va supprimer DEFINITIVEMENT tous les RDV, clients, relances et imports. Continuer ?')) return;
    setDangerConfirming(true);
    setDangerError('');
    const res = await fetch('/api/backup/delete-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: dangerPassword }),
    });
    const json = await res.json();
    setDangerConfirming(false);
    if (!res.ok) {
      setDangerError(json.error || 'Erreur.');
      return;
    }
    setDangerPassword('');
    alert('Toutes les donnees ont ete supprimees.');
    loadBatches();
  }

  async function deleteMonthData() {
    if (!deleteMonthPassword) return;
    if (!confirm(`Supprimer DEFINITIVEMENT tous les RDV du mois "${deleteMonth}" ? Continuer ?`)) return;
    setDeleteMonthConfirming(true);
    setDeleteMonthError('');
    const res = await fetch('/api/backup/delete-month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: deleteMonth, password: deleteMonthPassword }),
    });
    const json = await res.json();
    setDeleteMonthConfirming(false);
    if (!res.ok) {
      setDeleteMonthError(json.error || 'Erreur.');
      return;
    }
    setDeleteMonthPassword('');
    alert(`${json.deleted} RDV supprimes pour "${deleteMonth}".`);
    loadBatches();
  }

  async function loadAutoBackups() {
    setLoadingAuto(true);
    const res = await fetch('/api/backup/history', { cache: 'no-store' });
    const json = await res.json();
    setAutoBackups(json.data || []);
    setLoadingAuto(false);
  }

  useEffect(() => { loadAutoBackups(); }, []);

  async function downloadAuto(id: string, date: string) {
    const res = await fetch(`/api/backup/history/${id}`);
    if (!res.ok) { alert('Erreur lors du telechargement.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isobat-planning-auto-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreAuto(id: string, date: string) {
    const ok = confirm(
      `Restaurer la sauvegarde automatique du ${date} ? Ceci va SUPPRIMER toutes les donnees ` +
      `actuelles et les remplacer. Cette action est irreversible.`
    );
    if (!ok) return;
    setRestoringId(id);
    const res = await fetch(`/api/backup/history/${id}`, { method: 'POST' });
    const json = await res.json();
    setRestoringId(null);
    if (!res.ok) {
      alert(json.error || 'Erreur lors de la restauration.');
      return;
    }
    alert(`${json.inserted} RDV restaures.`);
  }

  async function download() {
    const res = await fetch('/api/backup');
    if (!res.ok) {
      alert('Erreur lors de la generation de la sauvegarde.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isobat-planning-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore() {
    if (!file) return;
    if (mode === 'replace') {
      const ok = confirm(
        'Cette action va SUPPRIMER toutes les donnees actuelles et les remplacer par celles ' +
        'de la sauvegarde. Cette action est irreversible. Continuer ?'
      );
      if (!ok) return;
    }
    setRestoring(true);
    setError('');
    setResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rdv: parsed.rdv || [], parametres: parsed.parametres || [], mode }),
      });
      const json = await res.json();
      setRestoring(false);
      if (!res.ok) {
        setError(json.error || 'Erreur lors de la restauration.');
        return;
      }
      setResult(`${json.inserted} RDV et ${json.parametresRestored} liste(s) de parametres restaures.`);
    } catch (e: any) {
      setRestoring(false);
      setError('Fichier illisible : ce n\'est pas une sauvegarde valide de cette application.');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink mb-1">Sauvegarde</h1>
      <p className="text-ink/60 text-sm mb-6">
        Telecharge une copie complete de tes donnees (RDV + parametres), ou restaure une
        sauvegarde precedente.
      </p>

      {role === 'admin' && (
        <div className="bg-white rounded-lg border border-black/5 p-5 mb-6">
          <ImportSection onImported={loadBatches} />
        </div>
      )}

      {role === 'admin' && (
        <div className="bg-white rounded-lg border border-black/5 p-5 mb-6">
          <h2 className="font-semibold text-ink mb-2">Imports precedents</h2>
          <p className="text-sm text-ink/60 mb-3">
            Chaque import est trace ici. Tu peux supprimer un import precis (et uniquement ses
            RDV) si besoin.
          </p>
          {loadingBatches && <p className="text-sm text-ink/40">Chargement...</p>}
          {!loadingBatches && batches.length === 0 && (
            <p className="text-sm text-ink/40 italic">Aucun import pour l'instant.</p>
          )}
          {batches.length > 0 && (
            <ul className="divide-y divide-black/5">
              {batches.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{b.filename || 'Fichier sans nom'}</div>
                    <div className="text-ink/50 text-xs">
                      {b.row_count} RDV · {(b.months || []).join(', ')} · {new Date(b.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteBatch(b.id, b.filename)}
                    disabled={deletingBatchId === b.id}
                    className="text-statut-annule hover:underline text-xs disabled:opacity-50"
                  >
                    {deletingBatchId === b.id ? 'Suppression...' : 'Supprimer cet import'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-black/5 p-5 mb-6">
        <h2 className="font-semibold text-ink mb-2">Telecharger une sauvegarde</h2>
        <p className="text-sm text-ink/60 mb-3">
          Genere un fichier .json contenant tous tes RDV et toutes tes listes Parametres.
          A faire regulierement, ou avant toute manipulation importante.
        </p>
        <button
          onClick={download}
          className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          Telecharger la sauvegarde
        </button>
      </div>

      <div className="bg-white rounded-lg border border-black/5 p-5 mb-6">
        <h2 className="font-semibold text-ink mb-2">Sauvegardes automatiques</h2>
        <p className="text-sm text-ink/60 mb-3">
          Une sauvegarde est generee automatiquement chaque nuit. Les 14 dernieres sont
          conservees ici.
        </p>
        {loadingAuto && <p className="text-sm text-ink/40">Chargement...</p>}
        {!loadingAuto && autoBackups.length === 0 && (
          <p className="text-sm text-ink/40 italic">
            Aucune sauvegarde automatique pour l'instant (la premiere sera generee cette nuit).
          </p>
        )}
        {autoBackups.length > 0 && (
          <ul className="divide-y divide-black/5">
            {autoBackups.map((b) => {
              const date = b.created_at.slice(0, 10);
              return (
                <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{new Date(b.created_at).toLocaleString('fr-FR')}</span>
                  <div className="flex gap-3">
                    <button onClick={() => downloadAuto(b.id, date)} className="text-forest hover:underline text-xs">
                      Telecharger
                    </button>
                    {role !== 'viewer' && (
                      <button
                        onClick={() => restoreAuto(b.id, date)}
                        disabled={restoringId === b.id}
                        className="text-gold hover:underline text-xs disabled:opacity-50"
                      >
                        {restoringId === b.id ? 'Restauration...' : 'Restaurer'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg border border-black/5 p-5">
        <h2 className="font-semibold text-ink mb-2">Restaurer une sauvegarde</h2>
        {role === 'viewer' ? (
          <p className="text-sm text-ink/50 italic">Reserve aux administrateurs.</p>
        ) : (
        <>
        <p className="text-sm text-ink/60 mb-3">
          Depose un fichier de sauvegarde .json genere par cette application.
        </p>

        <input
          type="file"
          accept=".json"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(''); }}
          className="block w-full text-sm mb-3"
        />

        <div className="flex gap-4 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            Remplacer tout (supprime les donnees actuelles avant de restaurer)
          </label>
        </div>
        <div className="flex gap-4 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            Ajouter seulement (garde les donnees actuelles, ajoute celles de la sauvegarde)
          </label>
        </div>

        <button
          onClick={restore}
          disabled={!file || restoring}
          className="bg-gold hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
        >
          {restoring ? 'Restauration...' : 'Restaurer'}
        </button>

        {error && (
          <div className="bg-statut-annule/10 text-statut-annule rounded-md p-3 mt-4 text-sm">{error}</div>
        )}
        {result && (
          <div className="bg-statut-honore/10 text-statut-honore rounded-md p-3 mt-4 text-sm">{result}</div>
        )}
        </>
        )}
      </div>

      {role === 'admin' && (
        <div className="bg-statut-annule/5 border-2 border-statut-annule/30 rounded-lg p-5 mt-6">
          <button
            onClick={() => setShowDangerZone((v) => !v)}
            className="text-statut-annule font-semibold text-sm"
          >
            {showDangerZone ? '▲' : '▼'} Zone dangereuse
          </button>
          {showDangerZone && (
            <div className="mt-3">
              <div className="bg-white border border-black/10 rounded-md p-3 mb-4">
                <h4 className="text-sm font-semibold text-ink mb-2">Supprimer un mois precis</h4>
                <p className="text-xs text-ink/60 mb-3">
                  Supprime uniquement les RDV du mois choisi. Le reste des donnees n'est pas touche.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <MonthYearPicker value={deleteMonth} onChange={setDeleteMonth} />
                  <input
                    type="password"
                    value={deleteMonthPassword}
                    onChange={(e) => setDeleteMonthPassword(e.target.value)}
                    placeholder="Retape ton mot de passe pour confirmer"
                    className="border border-statut-annule/40 rounded-md px-3 py-2 text-sm flex-1 max-w-xs"
                  />
                  <button
                    onClick={deleteMonthData}
                    disabled={!deleteMonthPassword || deleteMonthConfirming}
                    className="bg-statut-annule text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
                  >
                    {deleteMonthConfirming ? 'Suppression...' : `Supprimer "${deleteMonth}"`}
                  </button>
                </div>
                {deleteMonthError && <p className="text-statut-annule text-xs mt-2">{deleteMonthError}</p>}
              </div>

              <p className="text-sm text-ink/70 mb-3">
                Supprime <strong>definitivement</strong> tous les RDV, toutes les fiches client,
                tout l'historique de relance et tous les imports references. Cette action ne peut
                pas etre annulee (sauf en restaurant une sauvegarde faite avant). Reserve a
                l'Admin, confirmation par mot de passe obligatoire.
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="password"
                  value={dangerPassword}
                  onChange={(e) => setDangerPassword(e.target.value)}
                  placeholder="Retape ton mot de passe pour confirmer"
                  className="border border-statut-annule/40 rounded-md px-3 py-2 text-sm flex-1 max-w-xs"
                />
                <button
                  onClick={deleteAllData}
                  disabled={!dangerPassword || dangerConfirming}
                  className="bg-statut-annule text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {dangerConfirming ? 'Suppression...' : 'Tout supprimer'}
                </button>
              </div>
              {dangerError && <p className="text-statut-annule text-xs mt-2">{dangerError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
