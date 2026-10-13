'use client';

import { useEffect, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  created_at: string;
  has_password: boolean;
  username: string | null;
  univers: 'b2b' | 'b2c';
}
interface Cred { name: string; username: string; password: string; univers?: string }

export default function AgentPinsSection() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [univers, setUnivers] = useState<'b2b' | 'b2c'>('b2b');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [creds, setCreds] = useState<Cred[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUser, setEditUser] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/agent-pins', { cache: 'no-store' });
    const json = await res.json();
    setAgents(json.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const missing = agents.filter((a) => !a.has_password).length;

  async function createAgent() {
    if (!name.trim()) { setError('Le nom est requis.'); return; }
    setCreating(true); setError('');
    const res = await fetch('/api/agent-pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, univers }) });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) { setError(json.error || 'Erreur.'); return; }
    setCreds([{ name: json.data.name, username: json.data.username, password: json.data.password }]);
    setName('');
    load();
  }

  async function initAll() {
    const res = await fetch('/api/agent-pins', { method: 'PUT' });
    const json = await res.json();
    if (!res.ok) { alert(json.error || 'Erreur.'); return; }
    setCreds(json.data || []);
    load();
  }

  async function deleteAgent(a: Agent) {
    if (!confirm(`Supprimer l'agent "${a.name}" ?`)) return;
    await fetch(`/api/agent-pins/${a.id}`, { method: 'DELETE' });
    load();
  }

  async function switchUnivers(id: string, to: 'b2b' | 'b2c') {
    await fetch(`/api/agent-pins/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ univers: to }) });
    load();
  }

  async function regenerate(a: Agent) {
    if (!confirm(`Generer un nouveau mot de passe pour "${a.name}" ? L'ancien ne marchera plus et ses sessions seront deconnectees.`)) return;
    const res = await fetch(`/api/agent-pins/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regenerate: true }) });
    const json = await res.json();
    if (!res.ok) { alert(json.error || 'Erreur.'); return; }
    setCreds([{ name: a.name, username: json.username || a.username || '', password: json.password }]);
    load();
  }

  async function logout(a: Agent) {
    if (!confirm(`Deconnecter ${a.name} de tous ses appareils ?`)) return;
    const res = await fetch(`/api/agent-pins/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logout: true }) });
    alert(res.ok ? `${a.name} est deconnecte(e) (effet sous ~15 secondes).` : 'Erreur.');
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/agent-pins/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName, username: editUser }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || 'Erreur.'); return; }
    setEditId(null);
    load();
  }

  function copyAll() {
    const txt = creds.map((c) => `${c.name} : ${c.username} / ${c.password}`).join('\n');
    navigator.clipboard?.writeText(txt);
  }

  return (
    <div className="bg-white rounded-lg border border-black/5 p-4">
      <h2 className="font-semibold text-ink mb-3">Agents de prospection (identifiant + mot de passe)</h2>
      <p className="text-xs text-ink/50 mb-3">
        Chaque agent se connecte sur la page de connexion avec son identifiant (ex. hajer@isobat.crm) et son mot de passe personnel.
        Le mot de passe n&apos;est affiche qu&apos;au moment de sa creation : copie-le et transmets-le a l&apos;agent.
      </p>

      {creds.length > 0 && (
        <div className="border border-gold/50 bg-yellow-50 rounded-md p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Identifiants a transmettre (affiches une seule fois)</div>
            <div className="flex gap-3">
              <button onClick={copyAll} className="text-forest text-xs underline">Copier tout</button>
              <button onClick={() => setCreds([])} className="text-ink/40 text-xs">Fermer</button>
            </div>
          </div>
          <table className="text-sm w-full">
            <thead><tr className="text-left text-xs text-ink/50"><th className="pr-3">Agent</th><th className="pr-3">Identifiant</th><th>Mot de passe</th></tr></thead>
            <tbody>
              {creds.map((c, i) => (
                <tr key={i}><td className="pr-3 font-medium">{c.name}</td><td className="pr-3 font-mono text-xs">{c.username}</td><td className="font-mono text-xs select-all">{c.password}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'agent" className="flex-1 border border-black/10 rounded-md px-3 py-1.5 text-sm" />
        <select value={univers} onChange={(e) => setUnivers(e.target.value as 'b2b' | 'b2c')} className="border border-black/10 rounded-md px-2 text-sm">
          <option value="b2b">BtoB</option>
          <option value="b2c">BtoC</option>
        </select>
        <button onClick={createAgent} disabled={creating} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-3 rounded-md disabled:opacity-50">Ajouter</button>
      </div>
      {error && <p className="text-statut-annule text-xs mb-2">{error}</p>}

      {missing > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-forest-light rounded-md px-3 py-2">
          <span className="text-xs text-forest-dark">{missing} agent(s) sans identifiant / mot de passe.</span>
          <button onClick={initAll} className="bg-forest text-white text-xs font-medium px-3 py-1 rounded-md">Generer pour tous</button>
        </div>
      )}

      {loading && <p className="text-sm text-ink/40">Chargement...</p>}
      {!loading && agents.length === 0 && <p className="text-sm text-ink/40 italic">Aucun agent pour l&apos;instant.</p>}

      <ul className="divide-y divide-black/5">
        {agents.map((a) => (
          <li key={a.id} className="py-2 text-sm">
            {editId === a.id ? (
              <div className="flex flex-wrap gap-2 items-center">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-black/10 rounded px-2 py-1 text-sm" placeholder="Nom" />
                <input value={editUser} onChange={(e) => setEditUser(e.target.value)} className="border border-black/10 rounded px-2 py-1 text-xs w-56" placeholder="identifiant@isobat.crm" />
                <button onClick={() => saveEdit(a.id)} className="text-forest text-xs underline">Enregistrer</button>
                <button onClick={() => setEditId(null)} className="text-ink/40 text-xs">Annuler</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {a.name}{' '}
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${a.univers === 'b2c' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{a.univers === 'b2c' ? 'BtoC' : 'BtoB'}</span>{' '}
                  <span className="text-xs font-normal text-ink/50">{a.username || 'pas d\'identifiant'}</span>{' '}
                  {!a.has_password && <span className="text-gold text-xs font-normal">mot de passe a generer</span>}
                </span>
                <div className="flex gap-3 flex-wrap justify-end">
                  <button onClick={() => switchUnivers(a.id, a.univers === 'b2c' ? 'b2b' : 'b2c')} className="text-forest hover:underline text-xs">Passer en {a.univers === 'b2c' ? 'BtoB' : 'BtoC'}</button>
                  <button onClick={() => { setEditId(a.id); setEditName(a.name); setEditUser(a.username || ''); }} className="text-forest hover:underline text-xs">Modifier</button>
                  <button onClick={() => regenerate(a)} className="text-forest hover:underline text-xs">Nouveau mot de passe</button>
                  <button onClick={() => logout(a)} className="text-forest hover:underline text-xs">Deconnecter</button>
                  <button onClick={() => deleteAgent(a)} className="text-statut-annule hover:underline text-xs">Supprimer</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
