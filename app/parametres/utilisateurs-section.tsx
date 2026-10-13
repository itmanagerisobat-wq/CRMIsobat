'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'gestionnaire', label: 'Gestionnaire (comme Admin, sans Parametres/Sauvegarde)' },
  { value: 'viewer', label: 'Visualisation' },
  { value: 'relanceur', label: 'Relanceur' },
  { value: 'responsable_b2c', label: 'Responsable B2C (Relance/Carte/Stats B2C uniquement)' },
];

const ROLE_ORDER = ['admin', 'gestionnaire', 'relanceur', 'responsable_b2c', 'viewer'];

// Comptes prevus pour le moment : clic = pre-remplit le formulaire (il ne reste qu'a saisir le mot de passe)
const PLANNED: { name: string; role: string; label: string }[] = [
  { name: 'Ridha', role: 'admin', label: 'Admin' },
  { name: 'Ines', role: 'admin', label: 'Admin' },
  { name: 'Eya', role: 'gestionnaire', label: 'Gestionnaire' },
  { name: 'Oumeima', role: 'gestionnaire', label: 'Gestionnaire' },
  { name: 'Essia', role: 'gestionnaire', label: 'Gestionnaire' },
  { name: '', role: 'relanceur', label: 'Relanceur' },
  { name: '', role: 'responsable_b2c', label: 'Responsable B2C' },
];

interface LogRow {
  id: string;
  user_display_name: string | null;
  user_role: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Connexion',
  create_rdv: 'RDV cree',
  update_rdv: 'RDV modifie',
  delete_rdv: 'RDV supprime',
  create_user: 'Compte cree',
  update_user: 'Compte modifie',
  delete_user: 'Compte supprime',
  restore_backup: 'Sauvegarde restauree',
  import: 'Import de donnees',
};

export default function UtilisateursSection() {
  const role = useRole();
  const isAdmin = role === 'admin';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'viewer' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [resetId, setResetId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUser, setEditUser] = useState('');
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  async function loadLogs() {
    setLogsLoading(true);
    const res = await fetch('/api/activity?limit=150', { cache: 'no-store' });
    const json = await res.json();
    setLogs(json.data || []);
    setLogsLoading(false);
  }

  useEffect(() => { loadLogs(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/users', { cache: 'no-store' });
    const json = await res.json();
    setUsers(json.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    if (!form.username || !form.password || !form.display_name) {
      setError('Remplis identifiant, mot de passe et nom.');
      return;
    }
    setCreating(true);
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(json.error || 'Erreur lors de la creation.');
      return;
    }
    setForm({ username: '', password: '', display_name: '', role: 'viewer' });
    load();
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Supprimer le compte de ${name} ?`)) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    load();
  }

  async function submitReset(id: string) {
    if (!resetPassword) return;
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPassword }),
    });
    setResetId(null);
    setResetPassword('');
    alert('Mot de passe reinitialise.');
  }

  async function submitEdit(id: string) {
    if (!editName.trim() || !editUser.trim()) { alert('Nom et identifiant requis.'); return; }
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: editName.trim(), username: editUser.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || 'Erreur.'); return; }
    setEditId(null);
    load();
  }

  async function forceLogout(id: string, name: string) {
    if (!confirm(`Deconnecter ${name} de tous ses appareils ?`)) return;
    const res = await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logout: true }) });
    alert(res.ok ? `${name} est deconnecte(e) (effet sous ~15 secondes).` : 'Erreur.');
  }

  async function logoutAll() {
    if (!confirm('Deconnecter TOUS les comptes (sauf le tien) ?')) return;
    const res = await fetch('/api/users/logout-all', { method: 'POST' });
    alert(res.ok ? 'Tous les comptes sont deconnectes (effet sous ~15 secondes).' : 'Erreur.');
  }

  async function changeRole(id: string, role: string) {
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setChangingRoleId(null);
    load();
  }

  return (
    <div>

      {isAdmin && (
      <div className="bg-white rounded-lg border border-black/5 p-4 mb-6">
        <h2 className="font-semibold text-ink mb-2">Nouveau compte</h2>
        <div className="mb-3">
          <div className="text-xs text-ink/50 mb-1">Comptes prevus (clique pour pre-remplir, puis saisis le mot de passe) :</div>
          <div className="flex flex-wrap gap-2">
            {PLANNED.map((pl, i) => {
              const exists = pl.name
                ? users.some((u) => u.display_name.trim().toLowerCase() === pl.name.toLowerCase())
                : users.some((u) => u.role === pl.role);
              return (
                <button
                  key={i}
                  disabled={exists}
                  onClick={() => setForm({ username: pl.name.toLowerCase(), display_name: pl.name, password: '', role: pl.role })}
                  className={`text-xs px-2.5 py-1 rounded-full border ${exists ? 'bg-forest-light text-forest-dark border-forest/20 opacity-70' : 'bg-white border-black/10 hover:bg-forest-light'}`}
                >
                  {exists ? '✓ ' : '+ '}{pl.name || pl.label} <span className="text-ink/40">· {pl.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid sm:grid-cols-4 gap-2 mb-3">
          <input
            placeholder="Identifiant"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="border border-black/10 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Nom affiche"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            className="border border-black/10 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="border border-black/10 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        {error && <p className="text-statut-annule text-xs mb-2">{error}</p>}
        <button
          onClick={createUser}
          disabled={creating}
          className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
        >
          {creating ? 'Creation...' : '+ Creer le compte'}
        </button>
      </div>
      )}

      {isAdmin && users.length > 0 && (
        <div className="mb-4">
          <button onClick={logoutAll} className="text-xs border border-statut-annule/40 text-statut-annule rounded-md px-3 py-1.5 hover:bg-statut-annule/5">
            ⏻ Deconnecter tous les comptes
          </button>
        </div>
      )}

      {loading && <p className="text-ink/40 text-sm py-6">Chargement...</p>}
      {!loading && users.length === 0 && <p className="text-ink/40 text-sm py-6">Aucun compte nominatif pour l'instant.</p>}

      {ROLE_ORDER.map((rv) => {
        const group = users.filter((u) => u.role === rv);
        if (group.length === 0) return null;
        return (
          <div key={rv} className="mb-6">
            <h3 className="text-sm font-semibold text-ink/60 uppercase tracking-wide mb-2">
              {ROLES.find((r) => r.value === rv)?.label.split(' (')[0]} ({group.length})
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.map((u) => (
                <div key={u.id} className="bg-white rounded-lg border border-black/5 p-4">
                  {isAdmin && editId === u.id ? (
                    <div className="mb-2 space-y-1">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom affiche" className="border border-black/10 rounded px-2 py-1 text-sm w-full" />
                      <input value={editUser} onChange={(e) => setEditUser(e.target.value)} placeholder="Identifiant" className="border border-black/10 rounded px-2 py-1 text-xs w-full" />
                      <div className="flex gap-3">
                        <button onClick={() => submitEdit(u.id)} className="text-forest text-xs underline">Enregistrer</button>
                        <button onClick={() => setEditId(null)} className="text-ink/40 text-xs">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-ink leading-tight">{u.display_name}</div>
                      <div className="text-xs text-ink/50 mb-2">Identifiant : {u.username}</div>
                    </>
                  )}
                  <div className="mb-2">
                    {isAdmin && changingRoleId === u.id ? (
                      <select
                        autoFocus
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        onBlur={() => setChangingRoleId(null)}
                        className="border border-black/10 rounded px-2 py-1 text-xs bg-white"
                      >
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <button
                        disabled={!isAdmin}
                        onClick={() => setChangingRoleId(u.id)}
                        className="px-2 py-0.5 rounded-full text-xs font-medium bg-forest-light text-forest-dark hover:bg-forest/20"
                        title={isAdmin ? 'Cliquer pour changer le role' : undefined}
                      >
                        {ROLES.find((r) => r.value === u.role)?.label.split(' (')[0] || u.role}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-ink/50 mb-3">
                    Derniere connexion : {u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : 'Jamais'}
                  </div>
                  {isAdmin && (resetId === u.id ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="password"
                        placeholder="Nouveau mdp"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="border border-black/10 rounded px-2 py-1 text-xs w-28"
                      />
                      <button onClick={() => submitReset(u.id)} className="text-forest text-xs underline">Valider</button>
                      <button onClick={() => setResetId(null)} className="text-ink/40 text-xs">Annuler</button>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <button onClick={() => { setResetId(u.id); setResetPassword(''); }} className="text-forest hover:underline text-xs">
                        Reinitialiser mdp
                      </button>
                      <button onClick={() => forceLogout(u.id, u.display_name)} className="text-forest hover:underline text-xs">
                        Deconnecter
                      </button>
                      <button onClick={() => { setEditId(u.id); setEditName(u.display_name); setEditUser(u.username); }} className="text-forest hover:underline text-xs">
                        Modifier nom
                      </button>
                      <button onClick={() => deleteUser(u.id, u.display_name)} className="text-statut-annule hover:underline text-xs">
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <h2 className="text-lg font-semibold text-ink mb-2">Historique des actions</h2>
      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-forest-light text-forest-dark text-left">
              <th className="px-3 py-2 font-semibold text-xs uppercase">Date</th>
              <th className="px-3 py-2 font-semibold text-xs uppercase">Utilisateur</th>
              <th className="px-3 py-2 font-semibold text-xs uppercase">Action</th>
              <th className="px-3 py-2 font-semibold text-xs uppercase">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logsLoading && (
              <tr><td colSpan={4} className="text-center py-8 text-ink/40">Chargement...</td></tr>
            )}
            {!logsLoading && logs.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-ink/40">Aucune action enregistree.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-black/5">
                <td className="px-3 py-2 text-ink/50 text-xs whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString('fr-FR')}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{l.user_display_name || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{ACTION_LABELS[l.action] || l.action}</td>
                <td className="px-3 py-2 text-ink/60">{l.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
