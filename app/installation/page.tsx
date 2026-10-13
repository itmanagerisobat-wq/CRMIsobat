'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';
import { colorForName } from '@/lib/palette';
import { buildMonthLabel } from '@/lib/months';
import MonthYearPicker from '../month-year-picker';
import StatusTimeline from '../relance/status-timeline';

interface Inst {
  id: string; client: string; telephone: string | null; adresse: string | null;
  date_installation: string | null; statut: string | null; commentaire: string | null; created_at: string;
}

const EMPTY = { client: '', telephone: '', adresse: '', date_installation: '', statut: '', commentaire: '' };
const inp = 'w-full border border-black/10 rounded-md px-3 py-2 text-sm';
const monthOf = (iso: string | null | undefined) => {
  if (!iso) return '';
  const [y, m] = String(iso).slice(0, 10).split('-').map((n) => parseInt(n, 10));
  return y && m ? buildMonthLabel(y, m) : '';
};

/** Installation (B2C) : saisie manuelle, a partir des informations recues de la boite. Statuts : Parametres. */
export default function InstallationPage() {
  const role = useRole();
  const canEdit = role === 'admin' || role === 'gestionnaire' || role === 'responsable_b2c';
  const [rows, setRows] = useState<Inst[]>([]);
  const [statuts, setStatuts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('__ALL__');
  const [filterStatut, setFilterStatut] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<{ id: string; statut: string } | null>(null);
  const [pComment, setPComment] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch('/api/b2c-installations', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((x) => x.json()),
    ]);
    setRows(r.data || []);
    setStatuts(p.data?.statuts_installation || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const first = statuts[0] || '';
  const statutOf = (r: Inst) => r.statut || first;

  const shown = rows
    .filter((r) => month === '__ALL__' || monthOf(r.date_installation || r.created_at) === month)
    .filter((r) => !filterStatut || statutOf(r) === filterStatut)
    .filter((r) => !search.trim() || `${r.client} ${r.telephone || ''} ${r.adresse || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function patch(id: string, body: Record<string, any>) {
    const res = await fetch(`/api/b2c-installations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return false; }
    await load();
    return true;
  }

  async function create() {
    setError('');
    if (!form.client.trim()) { setError('Le nom du client est obligatoire.'); return; }
    setBusy(true);
    const res = await fetch('/api/b2c-installations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, statut: form.statut || first }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Erreur'); return; }
    setAdding(false); setForm({ ...EMPTY });
    load();
  }

  async function remove(r: Inst) {
    if (!confirm(`Supprimer l'installation de ${r.client} ?`)) return;
    const res = await fetch(`/api/b2c-installations/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    load();
  }

  async function confirmStatut(r: Inst) {
    if (!pending) return;
    const ok = await patch(r.id, { statut: pending.statut, statut_commentaire: pComment || null, ...(pComment ? { commentaire: pComment } : {}) });
    if (ok) setPending(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink">Installation (B2C)</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => { setAdding(true); setError(''); setForm({ ...EMPTY, statut: first }); }}
              className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-3 py-2 rounded-md">
              + Nouvelle installation
            </button>
          )}
          <MonthYearPicker value={month} onChange={setMonth} allowAll allLabel="Tous les mois" />
        </div>
      </div>
      <p className="text-ink/60 text-sm mb-3">Saisie manuelle, a partir des informations recues de notre boite. Les statuts se reglent dans Parametres.</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client..." className="border border-black/10 rounded-md px-3 py-1.5 text-sm bg-white w-60" />
        <button onClick={() => setFilterStatut('')} className={`rounded-md px-2.5 py-1 text-xs text-white bg-ink whitespace-nowrap ${filterStatut ? 'opacity-50' : ''}`}>
          Total <strong className="ml-1 text-sm">{rows.length}</strong>
        </button>
        {statuts.map((s) => (
          <button key={s} onClick={() => setFilterStatut(filterStatut === s ? '' : s)}
            className={`rounded-md px-2.5 py-1 text-xs text-white whitespace-nowrap ${filterStatut && filterStatut !== s ? 'opacity-40' : ''}`}
            style={{ backgroundColor: colorForName(s, statuts) }}>
            {s} <strong className="ml-1 text-sm">{rows.filter((r) => statutOf(r) === s).length}</strong>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left text-xs uppercase tracking-wide">
              <th className="px-3 py-2">Client</th><th className="px-3 py-2">Telephone</th><th className="px-3 py-2">Adresse</th>
              <th className="px-3 py-2">Date d'installation</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Commentaire</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-ink/40">Aucune installation.</td></tr>}
            {shown.map((r) => {
              const st = statutOf(r);
              const color = colorForName(st, statuts);
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-black/5 hover:bg-forest-light/40 align-top">
                    <td className="px-3 py-2 font-medium">{r.client}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.telephone || '—'}</td>
                    <td className="px-3 py-2 max-w-[220px] whitespace-normal">{r.adresse || '—'}</td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <input type="date" defaultValue={r.date_installation ? String(r.date_installation).slice(0, 10) : ''} key={`d${r.id}${r.date_installation}`}
                          onBlur={(e) => { if (e.target.value !== (r.date_installation ? String(r.date_installation).slice(0, 10) : '')) patch(r.id, { date_installation: e.target.value || null }); }}
                          className="text-xs border rounded px-1.5 py-1" />
                      ) : (r.date_installation ? new Date(r.date_installation).toLocaleDateString('fr-FR') : '—')}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select value={pending?.id === r.id ? pending.statut : st}
                          onChange={(e) => { if (e.target.value !== st) { setPending({ id: r.id, statut: e.target.value }); setPComment(''); } }}
                          className="text-xs border rounded px-1.5 py-1" style={{ borderColor: color, color, fontWeight: 600 }}>
                          {statuts.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '22', color }}>{st}</span>}
                      {pending?.id === r.id && (
                        <div className="mt-2 bg-gold-light rounded-md p-2 space-y-1.5 w-60 whitespace-normal">
                          <div className="text-xs font-medium">Nouveau statut : {pending.statut}</div>
                          <textarea value={pComment} onChange={(e) => setPComment(e.target.value)} rows={2} placeholder="Commentaire..." className="w-full text-xs border rounded px-2 py-1" />
                          <div className="flex gap-3">
                            <button onClick={() => confirmStatut(r)} className="text-forest text-xs font-semibold hover:underline">Valider</button>
                            <button onClick={() => setPending(null)} className="text-ink/40 text-xs hover:underline">Annuler</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[200px]">
                      {canEdit ? (
                        <textarea defaultValue={r.commentaire || ''} key={`c${r.id}${r.commentaire}`} rows={2}
                          onBlur={(e) => { if (e.target.value !== (r.commentaire || '')) patch(r.id, { commentaire: e.target.value || null }); }}
                          placeholder="Commentaire..." className="w-full text-xs border rounded px-2 py-1 whitespace-normal" />
                      ) : <span className="text-xs text-ink/70 whitespace-normal">{r.commentaire || '—'}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} className="text-xs font-semibold text-forest hover:underline mr-3">
                        {open[r.id] ? 'Masquer' : 'Historique'}
                      </button>
                      {canEdit && <button onClick={() => remove(r)} className="text-xs font-semibold text-statut-annule hover:underline">Supprimer</button>}
                    </td>
                  </tr>
                  {open[r.id] && (
                    <tr className="bg-forest-light/30"><td colSpan={7} className="px-4 py-3 max-w-xl"><StatusTimeline entityType="b2c" entityId={r.id} /></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setAdding(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-ink text-lg mb-3">Nouvelle installation</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-ink/60 mb-1">Client (nom et prenom)</label><input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className={inp} /></div>
              <div><label className="block text-xs font-medium text-ink/60 mb-1">Telephone</label><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className={inp} /></div>
              <div><label className="block text-xs font-medium text-ink/60 mb-1">Date d'installation</label><input type="date" value={form.date_installation} onChange={(e) => setForm({ ...form, date_installation: e.target.value })} className={inp} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-ink/60 mb-1">Adresse</label><input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} className={inp} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-ink/60 mb-1">Statut</label>
                <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className={`${inp} bg-white`}>
                  {statuts.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="block text-xs font-medium text-ink/60 mb-1">Commentaire</label><textarea value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} rows={3} className={`${inp} resize-none`} /></div>
            </div>
            {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={create} disabled={busy} className="flex-1 bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 rounded-md disabled:opacity-50">{busy ? 'Enregistrement...' : 'Enregistrer'}</button>
              <button onClick={() => setAdding(false)} disabled={busy} className="flex-1 bg-white border border-black/10 text-ink text-sm font-medium py-2 rounded-md">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
