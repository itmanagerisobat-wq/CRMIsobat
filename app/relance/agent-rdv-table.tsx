'use client';

import { useState } from 'react';

export interface AgentReq {
  id: string; created_at: string; agent_name: string | null; date: string; heure: string;
  raison_sociale: string | null; client: string | null; telephone: string | null; adresse: string | null;
  operation: string | null; departement: string | null; status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', validated: 'Validee', refused: 'Refusee', cancelled: 'Annulee',
};

const inp = 'w-full border border-black/10 rounded-md px-2 py-1.5 text-sm';

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}

export default function AgentRdvTable({
  rows, loading, canManage, canValidate, onChanged,
}: {
  rows: AgentReq[]; loading: boolean; canManage: boolean; canValidate: boolean; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AgentReq | null>(null);
  const [form, setForm] = useState<Partial<AgentReq>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function openEdit(r: AgentReq) {
    setEditing(r);
    setForm({
      date: r.date, heure: r.heure, raison_sociale: r.raison_sociale || '', client: r.client || '',
      telephone: r.telephone || '', adresse: r.adresse || '', operation: r.operation || '',
    });
    setError('');
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError('');
    const res = await fetch(`/api/rdv-requests/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Erreur'); return; }
    setEditing(null);
    onChanged();
  }

  async function changeStatus(r: AgentReq, status: string) {
    if (status === r.status) return;
    setBusyId(r.id);
    let res: Response;
    if (status === 'validated' && r.status === 'pending') {
      res = await fetch(`/api/rdv-requests/${r.id}/validate`, { method: 'POST' });
    } else {
      if (r.status === 'validated' && !confirm("Cette demande est deja validee : le RDV du Planning ne sera PAS modifie. Changer quand meme l'etat de la demande ?")) {
        setBusyId(null);
        return;
      }
      res = await fetch(`/api/rdv-requests/${r.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
    }
    setBusyId(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    window.dispatchEvent(new Event('rdv-requests-changed'));
    onChanged();
  }

  async function remove(r: AgentReq) {
    const warn = r.status === 'validated' ? "\n(Le RDV deja cree dans le Planning n'est pas supprime.)" : '';
    if (!confirm(`Supprimer definitivement la demande de ${r.raison_sociale || r.client || 'ce client'} ?${warn}`)) return;
    setBusyId(r.id);
    const res = await fetch(`/api/rdv-requests/${r.id}?hard=1`, { method: 'DELETE' });
    setBusyId(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    window.dispatchEvent(new Event('rdv-requests-changed'));
    onChanged();
  }

  const options = ['pending', 'refused', 'cancelled', 'validated'];

  return (
    <>
      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left">
              <Th>Pris le</Th><Th>Agent</Th><Th>Date RDV</Th><Th>Heure</Th><Th>Raison sociale</Th>
              <Th>Responsable</Th><Th>Telephone</Th><Th>Operation</Th><Th>Dept</Th><Th>Etat</Th>
              {canManage && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={11} className="text-center py-8 text-ink/40">Aucun RDV pris par les agents.</td></tr>
            )}
            {rows.map((q) => (
              <tr key={q.id} className="border-t border-black/5 hover:bg-forest-light/40 align-top">
                <Td>{q.created_at ? new Date(q.created_at).toLocaleDateString('fr-FR') : '—'}</Td>
                <Td>{q.agent_name || '—'}</Td>
                <Td>{q.date ? new Date(q.date).toLocaleDateString('fr-FR') : '—'}</Td>
                <Td>{q.heure || '—'}</Td>
                <Td>{q.raison_sociale || '—'}</Td>
                <Td>{q.client || '—'}</Td>
                <Td>{q.telephone || '—'}</Td>
                <Td>{q.operation || '—'}</Td>
                <Td>{q.departement || '—'}</Td>
                <Td>
                  {canManage ? (
                    <select
                      value={q.status}
                      disabled={busyId === q.id}
                      onChange={(e) => changeStatus(q, e.target.value)}
                      className="text-xs border rounded px-1.5 py-1"
                    >
                      {options
                        .filter((o) => o !== 'validated' || canValidate || q.status === 'validated')
                        .map((o) => <option key={o} value={o}>{STATUS_LABEL[o]}</option>)}
                    </select>
                  ) : (STATUS_LABEL[q.status] || q.status)}
                </Td>
                {canManage && (
                  <Td>
                    <button onClick={() => openEdit(q)} className="text-xs font-semibold text-forest hover:underline mr-3">Modifier</button>
                    <button onClick={() => remove(q)} disabled={busyId === q.id} className="text-xs font-semibold text-statut-annule hover:underline">Supprimer</button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ink text-lg">Modifier le RDV de l'agent</h2>
              <button onClick={() => setEditing(null)} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
            </div>
            {editing.status === 'validated' && (
              <p className="text-xs bg-gold-light rounded px-3 py-2 mb-3">Demande deja validee : le RDV du Planning n'est pas modifie par cette correction.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-ink/60">Date</label><input type="date" value={form.date || ''} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inp} /></div>
              <div><label className="text-xs text-ink/60">Heure</label><input type="time" value={form.heure || ''} onChange={(e) => setForm((f) => ({ ...f, heure: e.target.value }))} className={inp} /></div>
              <input placeholder="Raison sociale" value={form.raison_sociale || ''} onChange={(e) => setForm((f) => ({ ...f, raison_sociale: e.target.value }))} className={`${inp} col-span-2`} />
              <input placeholder="Responsable" value={form.client || ''} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} className={inp} />
              <input placeholder="Telephone" value={form.telephone || ''} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className={inp} />
              <input placeholder="Adresse" value={form.adresse || ''} onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} className={`${inp} col-span-2`} />
              <input placeholder="Operation" value={form.operation || ''} onChange={(e) => setForm((f) => ({ ...f, operation: e.target.value }))} className={`${inp} col-span-2`} />
            </div>
            {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mt-3">{error}</p>}
            <button onClick={saveEdit} disabled={saving} className="w-full bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-40 mt-3">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
