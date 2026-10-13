'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';
import { useUnivers } from '@/lib/use-univers';

interface Client {
  id: string;
  type: 'b2b' | 'b2c';
  raison_sociale: string | null;
  nom: string | null;
  prenom: string | null;
  adresse: string | null;
  responsable: string | null;
  fonction_responsable: string | null;
  telephone: string | null;
  site_info: Record<string, string> | null;
}

interface RdvSummary {
  id: string;
  date: string | null;
  month: string;
  operation: string | null;
  statut: string | null;
  sous_statut: string | null;
}

function clientLabel(c: Client): string {
  if (c.type === 'b2c') return [c.prenom, c.nom].filter(Boolean).join(' ') || 'Sans nom';
  return c.raison_sociale || 'Sans nom';
}

export default function ClientsPage() {
  const role = useRole();
  const canEdit = role === 'admin' || role === 'gestionnaire';
  const [clients, setClients] = useState<Client[]>([]);
  const [champsSite, setChampsSite] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const univers = useUnivers();
  const [typeFilter, setTypeFilter] = useState<'all' | 'b2b' | 'b2c'>('all');
  const [newType, setNewTypeState] = useState<'b2b' | 'b2c'>('b2b');
  const setNewType = setNewTypeState;
  useEffect(() => { setTypeFilter(univers); setNewTypeState(univers); }, [univers]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [history, setHistory] = useState<RdvSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const [cRes, pRes] = await Promise.all([
      fetch('/api/clients', { cache: 'no-store' }),
      fetch('/api/parametres', { cache: 'no-store' }),
    ]);
    const cJson = await cRes.json();
    const pJson = await pRes.json();
    setClients(cJson.data || []);
    setChampsSite(pJson.data?.champs_site || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openClient(c: Client) {
    setSelected(c);
    setEditForm({ ...c, site_info: { ...(c.site_info || {}) } });
    setHistoryLoading(true);
    const res = await fetch('/api/rdv', { cache: 'no-store' });
    const json = await res.json();
    const rows = (json.data || []) as any[];
    const key = c.type === 'b2b' ? c.raison_sociale : `${c.prenom || ''} ${c.nom || ''}`.trim();
    const mine = rows
      .filter((r) => (r.raison_sociale || r.client || '').trim().toLowerCase() === (key || '').trim().toLowerCase())
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setHistory(mine);
    setHistoryLoading(false);
  }

  function startCreate() {
    setSelected(null);
    setCreating(true);
    setEditForm({ type: newType, site_info: {} });
  }

  async function saveClient() {
    setSaving(true);
    const isNew = creating;
    const url = isNew ? '/api/clients' : `/api/clients/${selected!.id}`;
    const method = isNew ? 'POST' : 'PATCH';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Erreur.');
      return;
    }
    setSelected(null);
    setCreating(false);
    load();
  }

  async function deleteClient(id: string) {
    if (!confirm('Supprimer cette fiche client ?')) return;
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    setSelected(null);
    load();
  }



  function exportClients(withVisits: boolean) {
    window.location.href = `/api/clients/export?avec_visite=${withVisits ? '1' : '0'}`;
  }

  const filtered = clients
    .filter((c) => typeFilter === 'all' || c.type === typeFilter)
    .filter((c) => !search.trim() || clientLabel(c).toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink">Fiche client</h1>
        <div className="flex gap-2">
          <button onClick={() => exportClients(false)} className="bg-white border border-black/10 hover:bg-forest-light text-ink text-sm font-medium px-3 py-2 rounded-md">
            ↓ Export simple
          </button>
          <button onClick={() => exportClients(true)} className="bg-white border border-black/10 hover:bg-forest-light text-ink text-sm font-medium px-3 py-2 rounded-md">
            ↓ Export avec visites
          </button>
          {canEdit && (
            <button onClick={startCreate} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-3 py-2 rounded-md">
              + Nouveau client
            </button>
          )}
        </div>
      </div>
      <p className="text-ink/60 text-sm mb-4">
        Carnet d'adresses B2B (entreprises) et B2C (particuliers), alimente automatiquement a partir
        des RDV (Planning, demandes des agents, RDV B2C confirmes) : aucun import manuel.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="flex-1 min-w-[220px] max-w-md border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
        />
        <div className="flex bg-white border border-black/10 rounded-md overflow-hidden text-sm">
          {(['all', 'b2b', 'b2c'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 font-medium ${typeFilter === t ? 'bg-forest text-white' : 'text-ink/60'}`}
            >
              {t === 'all' ? 'Tous' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg border border-black/5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-light text-forest-dark text-left">
                <th className="px-3 py-2 font-semibold text-xs uppercase">Type</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Nom</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Adresse</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Telephone</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-ink/40">Aucun client.</td></tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => { setCreating(false); openClient(c); }}
                  className={`border-t border-black/5 cursor-pointer hover:bg-forest-light/40 ${selected?.id === c.id ? 'bg-forest-light' : ''}`}
                >
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${c.type === 'b2b' ? 'bg-forest/10 text-forest' : 'bg-gold/10 text-gold'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{clientLabel(c)}</td>
                  <td className="px-3 py-2 text-ink/60">{c.adresse || '—'}</td>
                  <td className="px-3 py-2">{c.telephone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg border border-black/5 p-4">
          {!selected && !creating ? (
            <p className="text-sm text-ink/40">Selectionne une fiche ou cree un nouveau client.</p>
          ) : (
            <>
              <h2 className="font-semibold text-ink mb-3">
                {creating ? 'Nouveau client' : clientLabel(selected!)}
              </h2>
              {canEdit ? (
                <div className="space-y-2 mb-4">
                  {creating && (
                    <div className="flex bg-forest-light rounded-md p-1 text-xs mb-2">
                      {(['b2b', 'b2c'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setNewType(t); setEditForm((f) => ({ ...f, type: t })); }}
                          className={`flex-1 py-1.5 rounded font-medium ${newType === t ? 'bg-white text-forest shadow-sm' : 'text-ink/50'}`}
                        >
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                  {(editForm.type || newType) === 'b2b' ? (
                    <input
                      value={editForm.raison_sociale || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, raison_sociale: e.target.value }))}
                      placeholder="Raison sociale"
                      className="w-full border border-black/10 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={editForm.prenom || ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, prenom: e.target.value }))}
                        placeholder="Prenom"
                        className="w-1/2 border border-black/10 rounded px-2 py-1 text-sm"
                      />
                      <input
                        value={editForm.nom || ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                        placeholder="Nom"
                        className="w-1/2 border border-black/10 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                  <input
                    value={editForm.adresse || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, adresse: e.target.value }))}
                    placeholder="Adresse"
                    className="w-full border border-black/10 rounded px-2 py-1 text-sm"
                  />
                  {(editForm.type || newType) === 'b2b' && (
                    <input
                      value={editForm.responsable || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, responsable: e.target.value }))}
                      placeholder="Responsable"
                      className="w-full border border-black/10 rounded px-2 py-1 text-sm"
                    />
                  )}
                  {(editForm.type || newType) === 'b2b' && (
                    <input
                      value={editForm.fonction_responsable || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, fonction_responsable: e.target.value }))}
                      placeholder="Fonction du responsable"
                      className="w-full border border-black/10 rounded px-2 py-1 text-sm"
                    />
                  )}
                  <input
                    value={editForm.telephone || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))}
                    placeholder="Telephone"
                    className="w-full border border-black/10 rounded px-2 py-1 text-sm"
                  />

                  {champsSite.length > 0 && (
                    <div className="pt-2 border-t border-black/5 mt-2">
                      <h3 className="text-xs font-semibold uppercase text-ink/50 mb-1.5">Informations de site</h3>
                      {champsSite.map((champ) => (
                        <input
                          key={champ}
                          value={editForm.site_info?.[champ] || ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, site_info: { ...(f.site_info || {}), [champ]: e.target.value } }))}
                          placeholder={champ}
                          className="w-full border border-black/10 rounded px-2 py-1 text-sm mb-1.5"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={saveClient} disabled={saving} className="bg-forest text-white text-xs font-medium px-3 py-1.5 rounded disabled:opacity-50">
                      {saving ? '...' : 'Enregistrer'}
                    </button>
                    {!creating && (
                      <button onClick={() => deleteClient(selected!.id)} className="text-statut-annule text-xs">
                        Supprimer la fiche
                      </button>
                    )}
                    <button onClick={() => { setSelected(null); setCreating(false); }} className="text-ink/40 text-xs">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-ink/70 space-y-1 mb-4">
                  <div>{selected!.adresse || 'Adresse non renseignee'}</div>
                  <div>{selected!.responsable || '—'}{selected!.fonction_responsable ? ` (${selected!.fonction_responsable})` : ''}</div>
                  <div>{selected!.telephone || '—'}</div>
                  {selected!.site_info && Object.entries(selected!.site_info).length > 0 && (
                    <div className="pt-2 border-t border-black/5 mt-2">
                      <h3 className="text-xs font-semibold uppercase text-ink/50 mb-1">Informations de site</h3>
                      {Object.entries(selected!.site_info).map(([k, v]) => (
                        <div key={k}>{k} : {v}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!creating && (
                <>
                  <h3 className="text-xs font-semibold uppercase text-ink/50 mb-2">Historique des RDV</h3>
                  {historyLoading && <p className="text-xs text-ink/40">Chargement...</p>}
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                    {history.map((r) => (
                      <li key={r.id} className="text-xs bg-forest-light/40 rounded px-2 py-1.5">
                        <div className="flex justify-between">
                          <span>{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : r.month}</span>
                          <span>{r.operation || '—'}</span>
                        </div>
                        <div className="text-ink/50">{r.statut || 'Confirme'}{r.sous_statut ? ` · ${r.sous_statut}` : ''}</div>
                      </li>
                    ))}
                    {!historyLoading && history.length === 0 && (
                      <li className="text-xs text-ink/40 italic">Aucun RDV enregistre.</li>
                    )}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
