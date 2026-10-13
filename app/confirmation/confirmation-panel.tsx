'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';
import { colorForName } from '@/lib/palette';
import { buildMonthLabel } from '@/lib/months';
import { FICHE_KEYS, FICHE_LABELS, isConfirme, isReporteConf } from '@/lib/b2c-flow';
import MonthYearPicker from '../month-year-picker';
import StatusTimeline from '../relance/status-timeline';
import FicheForm, { EMPTY_FICHE, FicheState, ficheToBody, rowToFiche } from '../mes-rdv-b2c/fiche-form';

interface Row {
  id: string; created_at: string; agent_name: string | null; client: string | null; telephone: string | null;
  adresse: string | null; operation: string | null; date: string | null; heure: string | null; commercial: string | null;
  confirmation_statut: string | null; confirmation_commentaire: string | null; status: string; fiche: any; rdv_id: string | null;
  valide_at: string | null; code_postal: string | null;
}

const monthOf = (iso: string | null | undefined) => {
  if (!iso) return '';
  const [y, m] = String(iso).slice(0, 10).split('-').map((n) => parseInt(n, 10));
  return y && m ? buildMonthLabel(y, m) : '';
};

export default function ConfirmationPanel({ embedded = false }: { embedded?: boolean }) {
  const role = useRole();
  const canEdit = role === 'admin' || role === 'gestionnaire' || role === 'responsable_b2c';
  const [rows, setRows] = useState<Row[]>([]);
  const [statuts, setStatuts] = useState<string[]>([]);
  const [commerciaux, setCommerciaux] = useState<string[]>([]);
  const [preconisations, setPreconisations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('__ALL__');
  const [todayOnly, setTodayOnly] = useState(false);
  const [filterStatut, setFilterStatut] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<{ id: string; statut: string } | null>(null);
  const [pComment, setPComment] = useState('');
  const [pDate, setPDate] = useState('');
  const [pHeure, setPHeure] = useState('');
  const [pError, setPError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FicheState>({ ...EMPTY_FICHE });
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch('/api/b2c-rdv', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((x) => x.json()),
    ]);
    setRows((r.data || []).filter((x: Row) => !!x.valide_at));
    setStatuts(p.data?.statuts_confirmation_b2c || []);
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

  async function inlineSave(r: Row, body: Record<string, any>) {
    const err = await patch(r.id, body);
    if (err) alert(err);
  }

  function startStatut(r: Row, statut: string) {
    if (statut === (r.confirmation_statut || '')) return;
    setPending({ id: r.id, statut });
    setPComment(''); setPError('');
    setPDate(r.date ? String(r.date).slice(0, 10) : '');
    setPHeure(r.heure || '');
  }

  async function confirmStatut(r: Row) {
    if (!pending) return;
    setBusy(true); setPError('');
    const body: Record<string, any> = { confirmation_statut: pending.statut, confirmation_commentaire: pComment };
    if (isReporteConf(pending.statut)) {
      if (!pDate || pDate === (r.date ? String(r.date).slice(0, 10) : '')) { setPError('Indique la nouvelle date.'); setBusy(false); return; }
      body.date = pDate; body.heure = pHeure || r.heure;
    }
    if (isConfirme(pending.statut)) { body.date = pDate || null; body.heure = pHeure || null; }
    const err = await patch(r.id, body);
    setBusy(false);
    if (err) { setPError(err); return; }
    setPending(null);
  }

  async function remove(r: Row) {
    const warn = r.rdv_id ? "\n(Le RDV deja cree dans le Planning n'est pas supprime.)" : '';
    if (!confirm(`Supprimer definitivement le RDV de ${r.client || 'ce client'} ?${warn}`)) return;
    const res = await fetch(`/api/b2c-rdv/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    load();
  }

  function openEdit(r: Row) { setEditing(r); setForm(rowToFiche(r)); setEditError(''); }
  async function saveEdit() {
    if (!editing) return;
    if (!form.client.trim() || !form.telephone.trim()) { setEditError('Nom et telephone obligatoires.'); return; }
    const err = await patch(editing.id, ficheToBody(form));
    if (err) { setEditError(err); return; }
    setEditing(null);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const shown = rows
    .filter((r) => month === '__ALL__' || monthOf(r.date || r.created_at) === month)
    .filter((r) => !todayOnly || String(r.date || '').slice(0, 10) === todayIso)
    .filter((r) => (filterStatut ? (r.confirmation_statut || 'A confirmer') === filterStatut : !isConfirme(r.confirmation_statut)));
  const todayCount = rows.filter((r) => String(r.date || '').slice(0, 10) === todayIso).length;
  const counts = statuts.map((s) => ({ s, n: rows.filter((r) => (r.confirmation_statut || 'A confirmer') === s).length }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          {embedded
            ? <h2 className="text-2xl font-extrabold text-gold uppercase tracking-wide">RDV a confirmer</h2>
            : <h1 className="text-2xl font-bold text-ink">Confirmation des RDV (B2C)</h1>}
          <p className="text-ink/60 text-sm">Clients valides, pas encore confirmes. Un RDV « Confirme » part dans le Planning et la Relance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTodayOnly((v) => !v)}
            className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${todayOnly ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-black/10 hover:bg-forest-light'}`}
          >
            📅 RDV aujourd'hui {todayCount > 0 ? `(${todayCount})` : ''}
          </button>
          <MonthYearPicker value={month} onChange={setMonth} allowAll allLabel="Tous les mois" />
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-2 mb-3 overflow-x-auto pb-1">
        <button onClick={() => setFilterStatut('')} className={`shrink-0 rounded-md px-2.5 py-1 text-xs text-white bg-ink whitespace-nowrap ${filterStatut ? 'opacity-50' : ''}`}>
          Total <strong className="ml-1 text-sm">{rows.length}</strong>
        </button>
        {counts.map(({ s, n }) => (
          <button key={s} onClick={() => setFilterStatut(filterStatut === s ? '' : s)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs text-white whitespace-nowrap ${filterStatut && filterStatut !== s ? 'opacity-40' : ''}`}
            style={{ backgroundColor: colorForName(s, statuts) }}>
            {s} <strong className="ml-1 text-sm">{n}</strong>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left text-xs uppercase tracking-wide">
              <th className="px-3 py-2">Saisi le</th><th className="px-3 py-2">Agent</th><th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Telephone</th><th className="px-3 py-2">Preconisation</th>
              <th className="px-3 py-2">Date</th><th className="px-3 py-2">Heure</th><th className="px-3 py-2">Commercial</th>
              <th className="px-3 py-2">Confirmation</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-ink/40">Aucun RDV.</td></tr>}
            {shown.map((r) => {
              const st = r.confirmation_statut || 'A confirmer';
              const color = colorForName(st, statuts);
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
                      {canEdit ? (
                        <input type="date" defaultValue={r.date ? String(r.date).slice(0, 10) : ''} key={`d${r.id}${r.date}`}
                          onBlur={(e) => { if (e.target.value !== (r.date ? String(r.date).slice(0, 10) : '')) inlineSave(r, { date: e.target.value || null }); }}
                          className="text-xs border rounded px-1.5 py-1" />
                      ) : (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—')}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <input type="time" defaultValue={r.heure || ''} key={`h${r.id}${r.heure}`}
                          onBlur={(e) => { if (e.target.value !== (r.heure || '')) inlineSave(r, { heure: e.target.value || null }); }}
                          className="text-xs border rounded px-1.5 py-1" />
                      ) : (r.heure || '—')}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select value={r.commercial || ''} onChange={(e) => inlineSave(r, { commercial: e.target.value || null })} className="text-xs border rounded px-1.5 py-1">
                          <option value="">— affecter —</option>
                          {commerciaux.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (r.commercial || '—')}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select value={pending?.id === r.id ? pending.statut : st} onChange={(e) => startStatut(r, e.target.value)}
                          className="text-xs border rounded px-1.5 py-1" style={{ borderColor: color, color, fontWeight: 600 }}>
                          {statuts.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '22', color }}>{st}</span>}
                      {r.confirmation_commentaire && <div className="text-[11px] text-ink/60 mt-1 max-w-[220px] whitespace-normal">{r.confirmation_commentaire}</div>}
                      {pending?.id === r.id && (
                        <div className="mt-2 bg-gold-light rounded-md p-2 space-y-1.5 w-60 whitespace-normal">
                          <div className="text-xs font-medium">Nouveau statut : {pending.statut}</div>
                          {(isReporteConf(pending.statut) || isConfirme(pending.statut)) && (
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[11px] text-ink/60">{isReporteConf(pending.statut) ? 'Nouvelle date *' : 'Date *'}</label>
                                <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1" />
                              </div>
                              <div>
                                <label className="text-[11px] text-ink/60">Heure *</label>
                                <input type="time" value={pHeure} onChange={(e) => setPHeure(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1" />
                              </div>
                            </div>
                          )}
                          {isConfirme(pending.statut) && !r.commercial && <p className="text-[11px] text-statut-annule">Pense a affecter un commercial.</p>}
                          <textarea value={pComment} onChange={(e) => setPComment(e.target.value)} rows={2} placeholder="Commentaire..." className="w-full text-xs border rounded px-2 py-1" />
                          {pError && <p className="text-statut-annule text-xs">{pError}</p>}
                          <div className="flex gap-3">
                            <button onClick={() => confirmStatut(r)} disabled={busy} className="text-forest text-xs font-semibold hover:underline disabled:opacity-50">{busy ? '...' : 'Valider'}</button>
                            <button onClick={() => setPending(null)} className="text-ink/40 text-xs hover:underline">Annuler</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} className="text-xs font-semibold text-forest hover:underline mr-3">
                        {open[r.id] ? 'Masquer' : 'Details'}
                      </button>
                      {canEdit && <button onClick={() => openEdit(r)} className="text-xs font-semibold text-forest hover:underline mr-3">Modifier</button>}
                      {canEdit && <button onClick={() => remove(r)} className="text-xs font-semibold text-statut-annule hover:underline">Supprimer</button>}
                    </td>
                  </tr>
                  {open[r.id] && (
                    <tr className="bg-forest-light/30">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="text-xs text-ink/80 grid grid-cols-2 gap-x-6 gap-y-1">
                            <span><strong>Adresse :</strong> {r.adresse || '—'}{r.code_postal ? ` (${r.code_postal})` : ''}</span>
                            {FICHE_KEYS.map((k) => (
                              <span key={k}><strong>{FICHE_LABELS[k]} :</strong> {fiche[k] || '—'}</span>
                            ))}
                          </div>
                          <StatusTimeline entityType="b2c" entityId={r.id} />
                        </div>
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
