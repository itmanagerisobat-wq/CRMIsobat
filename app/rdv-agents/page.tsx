'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';
import { buildMonthLabel } from '@/lib/months';
import { FICHE_KEYS, FICHE_LABELS } from '@/lib/b2c-flow';
import MonthYearPicker from '../month-year-picker';
import FicheForm, { EMPTY_FICHE, FicheState, ficheToBody, rowToFiche } from '../mes-rdv-b2c/fiche-form';

interface Row {
  id: string; created_at: string; agent_name: string | null; client: string | null; telephone: string | null;
  adresse: string | null; code_postal: string | null; operation: string | null; date: string | null; heure: string | null;
  commercial: string | null; valide_at: string | null; fiche: any;
}

const monthOf = (iso: string | null | undefined) => {
  if (!iso) return '';
  const [y, m] = String(iso).slice(0, 10).split('-').map((n) => parseInt(n, 10));
  return y && m ? buildMonthLabel(y, m) : '';
};

/** Etape 1 : RDV envoyes par les agents B2C, a valider par la responsable (date + heure) avant la Confirmation. */
export default function RdvAgentsPage() {
  const role = useRole();
  const canEdit = role === 'admin' || role === 'gestionnaire' || role === 'responsable_b2c';
  const [rows, setRows] = useState<Row[]>([]);
  const [commerciaux, setCommerciaux] = useState<string[]>([]);
  const [preconisations, setPreconisations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('__ALL__');
  const [todayOnly, setTodayOnly] = useState(false);
  const [showValidated, setShowValidated] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FicheState>({ ...EMPTY_FICHE });
  const [editError, setEditError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch('/api/b2c-rdv', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((x) => x.json()),
    ]);
    setRows(r.data || []);
    setCommerciaux(p.data?.commerciaux_b2c || []);
    setPreconisations(p.data?.preconisations_b2c || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  async function patch(id: string, body: Record<string, any>): Promise<string | null> {
    const res = await fetch(`/api/b2c-rdv/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); return j.error || 'Erreur'; }
    await load();
    return null;
  }

  async function valider(r: Row) {
    setBusyId(r.id);
    const err = await patch(r.id, { action: 'valider' });
    setBusyId(null);
    if (err) alert(err);
  }

  async function remove(r: Row) {
    if (!confirm(`Supprimer definitivement le RDV de ${r.client || 'ce client'} ?`)) return;
    const res = await fetch(`/api/b2c-rdv/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    if (!form.client.trim() || !form.telephone.trim()) { setEditError('Nom et telephone obligatoires.'); return; }
    const err = await patch(editing.id, ficheToBody(form));
    if (err) { setEditError(err); return; }
    setEditing(null);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const base = rows.filter((r) => showValidated || !r.valide_at);
  const shown = base
    .filter((r) => month === '__ALL__' || monthOf(r.date || r.created_at) === month)
    .filter((r) => !todayOnly || String(r.date || '').slice(0, 10) === todayIso);
  const toValidate = rows.filter((r) => !r.valide_at).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink">RDV envoyes par les agents (B2C)</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTodayOnly((v) => !v)}
            className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${todayOnly ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-black/10 hover:bg-forest-light'}`}
          >
            📅 RDV aujourd'hui
          </button>
          <MonthYearPicker value={month} onChange={setMonth} allowAll allLabel="Tous les mois" />
        </div>
      </div>
      <p className="text-ink/60 text-sm mb-3">
        {toValidate} RDV a valider. Fixe la date et l'heure puis clique sur « Valider » : le RDV passe dans l'onglet Confirmation.
      </p>
      <label className="flex items-center gap-2 text-xs text-ink/60 mb-3">
        <input type="checkbox" checked={showValidated} onChange={(e) => setShowValidated(e.target.checked)} /> Afficher aussi les RDV deja valides
      </label>

      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left text-xs uppercase tracking-wide">
              <th className="px-3 py-2">Envoye le</th><th className="px-3 py-2">Agent</th><th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Telephone</th><th className="px-3 py-2">Preconisation</th>
              <th className="px-3 py-2">Date</th><th className="px-3 py-2">Heure</th><th className="px-3 py-2">Commercial</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-ink/40">Aucun RDV.</td></tr>}
            {shown.map((r) => {
              const fiche = (typeof r.fiche === 'string' ? JSON.parse(r.fiche) : r.fiche) || {};
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-black/5 hover:bg-forest-light/40 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2">{r.agent_name || '—'}</td>
                    <td className="px-3 py-2 font-medium">{r.client || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.telephone || '—'}</td>
                    <td className="px-3 py-2">{r.operation || '—'}</td>
                    <td className="px-3 py-2">
                      {canEdit && !r.valide_at ? (
                        <input type="date" defaultValue={r.date ? String(r.date).slice(0, 10) : ''} key={`d${r.id}${r.date}`}
                          onBlur={(e) => { if (e.target.value !== (r.date ? String(r.date).slice(0, 10) : '')) patch(r.id, { date: e.target.value || null }).then((er) => er && alert(er)); }}
                          className="text-xs border rounded px-1.5 py-1" />
                      ) : (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—')}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && !r.valide_at ? (
                        <input type="time" defaultValue={r.heure || ''} key={`h${r.id}${r.heure}`}
                          onBlur={(e) => { if (e.target.value !== (r.heure || '')) patch(r.id, { heure: e.target.value || null }).then((er) => er && alert(er)); }}
                          className="text-xs border rounded px-1.5 py-1" />
                      ) : (r.heure || '—')}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && !r.valide_at ? (
                        <select value={r.commercial || ''} onChange={(e) => patch(r.id, { commercial: e.target.value || null }).then((er) => er && alert(er))} className="text-xs border rounded px-1.5 py-1">
                          <option value="">— affecter —</option>
                          {commerciaux.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (r.commercial || '—')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.valide_at ? (
                        <span className="text-xs text-forest font-semibold mr-3">✓ Valide</span>
                      ) : canEdit && (
                        <button onClick={() => valider(r)} disabled={busyId === r.id}
                          className="bg-forest hover:bg-forest-dark text-white text-xs font-semibold px-3 py-1 rounded mr-3 disabled:opacity-50">
                          Valider
                        </button>
                      )}
                      <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} className="text-xs font-semibold text-forest hover:underline mr-3">
                        {open[r.id] ? 'Masquer' : 'Details'}
                      </button>
                      {canEdit && !r.valide_at && <button onClick={() => { setEditing(r); setForm(rowToFiche(r)); setEditError(''); }} className="text-xs font-semibold text-forest hover:underline mr-3">Modifier</button>}
                      {canEdit && !r.valide_at && <button onClick={() => remove(r)} className="text-xs font-semibold text-statut-annule hover:underline">Supprimer</button>}
                    </td>
                  </tr>
                  {open[r.id] && (
                    <tr className="bg-forest-light/30">
                      <td colSpan={9} className="px-4 py-3 text-xs text-ink/80 grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                        <span><strong>Adresse :</strong> {r.adresse || '—'}</span>
                        <span><strong>Code postal :</strong> {r.code_postal || '—'}</span>
                        {FICHE_KEYS.map((k) => <span key={k}><strong>{FICHE_LABELS[k]} :</strong> {fiche[k] || '—'}</span>)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ink text-lg">Modifier la fiche</h2>
              <button onClick={() => setEditing(null)} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
            </div>
            <FicheForm value={form} onChange={setForm} preconisations={preconisations} />
            {editError && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mt-3">{editError}</p>}
            <button onClick={saveEdit} className="mt-4 bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md">Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}
