'use client';

import { useEffect, useState } from 'react';
import { useUnivers } from '@/lib/use-univers';

interface Req {
  id: string;
  date: string;
  heure: string;
  code_postal: string | null;
  departement: string | null;
  agent_name: string | null;
  slot_status: string | null;
  raison_sociale: string | null;
  client: string | null;
  telephone: string | null;
  adresse: string | null;
  operation: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  validated: 'Validee',
  refused: 'Refusee',
  cancelled: 'Annulee',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gold/10 text-gold',
  validated: 'bg-statut-honore/10 text-statut-honore',
  refused: 'bg-statut-annule/10 text-statut-annule',
  cancelled: 'bg-ink/10 text-ink/50',
};

export default function DemandesBanner({ onChange }: { onChange?: () => void }) {
  const univers = useUnivers();
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [busyAll, setBusyAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Req>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Req[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionToast, setActionToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  async function load() {
    const res = await fetch(`/api/rdv-requests?status=pending&univers=${univers}`, { cache: 'no-store' });
    const json = await res.json();
    const data: Req[] = json.data || [];
    setRequests(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [univers]);

  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(null), 5000);
    return () => clearTimeout(t);
  }, [actionToast]);

  async function loadHistory() {
    setHistoryLoading(true);
    const res = await fetch(`/api/rdv-requests?status=all&univers=${univers}`, { cache: 'no-store' });
    const json = await res.json();
    setHistory(json.data || []);
    setHistoryLoading(false);
  }

  async function validate(id: string) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/rdv-requests/${id}/validate`, { method: 'POST' });
      let json: any = {};
      try { json = await res.json(); } catch {
        throw new Error(`Reponse inattendue du serveur (code ${res.status}).`);
      }
      setBusyId(null);
      if (!res.ok) {
        setError(json.error || `Erreur lors de la validation (code ${res.status}).`);
        setActionToast({ type: 'error', text: json.error || 'Erreur lors de la validation.' });
        return;
      }
      load();
      if (showHistory) loadHistory();
      window.dispatchEvent(new Event('rdv-requests-changed'));
      onChange?.();
      setActionToast({ type: 'ok', text: 'Demande validee : le RDV a ete cree.' });
    } catch (e: any) {
      setBusyId(null);
      setError(e?.message || 'Erreur reseau lors de la validation.');
      setActionToast({ type: 'error', text: e?.message || 'Erreur reseau lors de la validation.' });
    }
  }

  async function refuse(id: string) {
    if (!confirm('Refuser cette demande ?')) return;
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/rdv-requests/${id}/refuse`, { method: 'POST' });
      let json: any = {};
      try { json = await res.json(); } catch {
        throw new Error(`Reponse inattendue du serveur (code ${res.status}).`);
      }
      setBusyId(null);
      if (!res.ok) {
        setError(json.error || `Erreur lors du refus (code ${res.status}).`);
        setActionToast({ type: 'error', text: json.error || 'Erreur lors du refus.' });
        return;
      }
      load();
      if (showHistory) loadHistory();
      window.dispatchEvent(new Event('rdv-requests-changed'));
      onChange?.();
      setActionToast({ type: 'ok', text: 'Demande refusee.' });
    } catch (e: any) {
      setBusyId(null);
      setError(e?.message || 'Erreur reseau lors du refus.');
      setActionToast({ type: 'error', text: e?.message || 'Erreur reseau lors du refus.' });
    }
  }

  async function validateAll() {
    if (!confirm(`Valider les ${requests.length} demande(s) en attente ?`)) return;
    setBusyAll(true);
    const res = await fetch('/api/rdv-requests/validate-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ univers }) });
    setBusyAll(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erreur lors de la validation en masse.');
      return;
    }
    load();
    if (showHistory) loadHistory();
    window.dispatchEvent(new Event('rdv-requests-changed'));
    onChange?.();
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    setError('');
    const res = await fetch(`/api/rdv-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erreur lors de la modification.');
      return;
    }
    setEditingId(null);
    load();
    setActionToast({ type: 'ok', text: 'Demande modifiee.' });
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) loadHistory();
  }

  return (
    <div className="mb-4">
      {actionToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md">
          <div className={`${actionToast.type === 'ok' ? 'bg-statut-honore' : 'bg-statut-annule'} text-white rounded-lg shadow-xl p-4 text-sm font-medium flex items-start justify-between gap-3`}>
            <span>{actionToast.type === 'ok' ? '✓' : '⚠️'} {actionToast.text}</span>
            <button onClick={() => setActionToast(null)} className="shrink-0 opacity-80 hover:opacity-100">×</button>
          </div>
        </div>
      )}
      {requests.length > 0 && (
        <div className="bg-forest-light border border-forest/30 rounded-md">
          <div className="w-full flex items-center justify-between px-4 py-2.5 text-sm">
            <button onClick={() => setOpen((o) => !o)} className="flex-1 text-left">
              🔔 <strong>{requests.length}</strong> demande(s) de RDV en attente (agents de prospection)
              <span className="text-xs text-ink/50 ml-2">{open ? 'Reduire ▲' : 'Voir ▼'}</span>
            </button>
            <button
              onClick={validateAll}
              disabled={busyAll}
              className="bg-forest hover:bg-forest-dark text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              {busyAll ? '...' : 'Tout valider'}
            </button>
          </div>
          {open && (
            <div className="px-4 pb-3">
              {requests.map((r) => (
                <div key={r.id} className="bg-white rounded mt-1.5 overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-left"
                  >
                    <span>
                      {new Date(r.date).toLocaleDateString('fr-FR')} · {r.heure} · {r.departement || r.code_postal || '—'}
                      {r.agent_name ? ` · ${r.agent_name}` : ''}
                      {r.slot_status && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${r.slot_status === 'best' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {r.slot_status === 'best' ? 'meilleure affectation' : 'moins adequat'}
                        </span>
                      )}
                    </span>
                    <span className="text-ink/40">{expanded === r.id ? '▲' : '▼'}</span>
                  </button>
                  {expanded === r.id && (
                    <div className="border-t border-black/5 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-forest-light/50 text-left">
                            <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Raison sociale</th>
                            <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Responsable</th>
                            <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Telephone</th>
                            <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Adresse</th>
                            <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Operation</th>
                            <th className="px-2 py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingId === r.id ? (
                            <tr>
                              <td className="px-2 py-1.5"><input value={editForm.raison_sociale || ''} onChange={(e) => setEditForm((f) => ({ ...f, raison_sociale: e.target.value }))} className="border border-black/10 rounded px-1.5 py-1 text-xs w-28" /></td>
                              <td className="px-2 py-1.5"><input value={editForm.client || ''} onChange={(e) => setEditForm((f) => ({ ...f, client: e.target.value }))} className="border border-black/10 rounded px-1.5 py-1 text-xs w-24" /></td>
                              <td className="px-2 py-1.5"><input value={editForm.telephone || ''} onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))} className="border border-black/10 rounded px-1.5 py-1 text-xs w-24" /></td>
                              <td className="px-2 py-1.5"><input value={editForm.adresse || ''} onChange={(e) => setEditForm((f) => ({ ...f, adresse: e.target.value }))} className="border border-black/10 rounded px-1.5 py-1 text-xs w-28" /></td>
                              <td className="px-2 py-1.5"><input value={editForm.operation || ''} onChange={(e) => setEditForm((f) => ({ ...f, operation: e.target.value }))} className="border border-black/10 rounded px-1.5 py-1 text-xs w-20" /></td>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => saveEdit(r.id)} disabled={busyId === r.id} className="text-forest font-medium hover:underline disabled:opacity-50">
                                    Enregistrer
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="text-ink/50 hover:underline">
                                    Annuler
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td className="px-2 py-1.5 whitespace-nowrap">{r.raison_sociale || '—'}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{r.client || '—'}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{r.telephone || '—'}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{r.adresse || '—'}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{r.operation || '—'}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => { setEditingId(r.id); setEditForm(r); }}
                                    className="text-blue-600 font-medium hover:underline"
                                  >
                                    Modifier
                                  </button>
                                  <button onClick={() => validate(r.id)} disabled={busyId === r.id} className="text-forest font-medium hover:underline disabled:opacity-50">
                                    Valider
                                  </button>
                                  <button onClick={() => refuse(r.id)} disabled={busyId === r.id} className="text-statut-annule font-medium hover:underline disabled:opacity-50">
                                    Refuser
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-statut-annule mt-2">{error}</p>}

      <div className="flex justify-end">
        <button onClick={toggleHistory} className="bg-forest hover:bg-forest-dark text-white text-sm font-semibold px-4 py-2.5 rounded-md mt-2 shadow-sm">
          📜 {showHistory ? 'Masquer' : 'Voir'} l'historique des demandes envoyees par les agents
        </button>
      </div>

      {showHistory && (
        <div className="bg-white rounded-lg border border-black/5 mt-2 overflow-x-auto">
          {historyLoading && <p className="text-xs text-ink/40 p-3">Chargement...</p>}
          {!historyLoading && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-forest-light text-forest-dark text-left">
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Date demande</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">RDV souhaite</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Agent</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Departement</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Raison sociale</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Operation</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Statut</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Resolue le</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-4 text-ink/40">Aucune demande.</td></tr>
                )}
                {history.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="px-2 py-1.5 whitespace-nowrap">{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{new Date(r.date).toLocaleDateString('fr-FR')} · {r.heure}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.agent_name || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.departement || r.code_postal || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.raison_sociale || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.operation || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.resolved_at ? new Date(r.resolved_at).toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => validate(r.id)} disabled={busyId === r.id} className="text-forest font-medium hover:underline disabled:opacity-50">
                            Valider
                          </button>
                          <button onClick={() => refuse(r.id)} disabled={busyId === r.id} className="text-statut-annule font-medium hover:underline disabled:opacity-50">
                            Refuser
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
