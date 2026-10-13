'use client';

import { Fragment, useRef, useState } from 'react';
import { useRole } from '@/lib/use-role';
import { colorForName } from '@/lib/palette';
import { Rdv } from '@/lib/types';
import MonthYearPicker from '../month-year-picker';
import StatusTimeline from '../relance/status-timeline';
import { useB2cDossiers, patchRdv, FileMeta } from '../use-b2c-dossiers';

/** Recuperation des papiers : un RDV y entre quand le resultat de la visite a abouti a la recuperation des papiers (liste dans Parametres) ; la responsable saisit le retour du commercial et joint les documents. */
export default function PapiersPage() {
  const role = useRole();
  const canEdit = role === 'admin' || role === 'gestionnaire' || role === 'responsable_b2c';
  const { rows, params, files, loading, reload } = useB2cDossiers();
  const [month, setMonth] = useState('__ALL__');
  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<{ id: string; statut: string } | null>(null);
  const [pComment, setPComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  const statuts = params.statuts_papiers || [];
  const positifs = params.statuts_papiers_ok || [];
  const firstStatut = statuts[0] || 'En attente des papiers';
  const statutOf = (r: Rdv) => r.papiers_statut || firstStatut;
  const isPositif = (r: Rdv) => positifs.includes(r.papiers_statut || '');

  const shown = rows
    .filter((r) => showDone || !isPositif(r))
    .filter((r) => month === '__ALL__' || r.month === month)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const enAttente = rows.filter((r) => !isPositif(r)).length;

  async function confirmStatut(r: Rdv) {
    if (!pending) return;
    setBusy(true);
    const err = await patchRdv(r.id, { papiers_statut: pending.statut, papiers_commentaire: pComment || r.papiers_commentaire || null });
    setBusy(false);
    if (err) { alert(err); return; }
    setPending(null);
    reload();
  }

  async function saveComment(r: Rdv, value: string) {
    if (value === (r.papiers_commentaire || '')) return;
    const err = await patchRdv(r.id, { papiers_commentaire: value || null });
    if (err) alert(err); else reload();
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const id = uploadFor.current;
    const list = Array.from(e.target.files || []);
    if (!id || list.length === 0) return;
    setUploadingId(id);
    for (const f of list) {
      const fd = new FormData();
      fd.append('rdv_id', id); fd.append('kind', 'papiers'); fd.append('file', f);
      const res = await fetch('/api/rdv-files', { method: 'POST', body: fd });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(`${f.name} : ${j.error || 'erreur'}`); break; }
    }
    setUploadingId(null);
    if (fileInput.current) fileInput.current.value = '';
    reload();
  }

  async function removeFile(f: FileMeta) {
    if (!confirm(`Supprimer ${f.filename} ?`)) return;
    await fetch(`/api/rdv-files/${f.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div>
      <input ref={fileInput} type="file" multiple className="hidden" onChange={onPickFiles} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink">Recuperation des papiers (B2C)</h1>
        <MonthYearPicker value={month} onChange={setMonth} allowAll allLabel="Tous les mois" />
      </div>
      <p className="text-ink/60 text-sm mb-2">
        {enAttente} dossier{enAttente > 1 ? 's' : ''} en attente. Quand le statut est positif ({positifs.join(', ') || 'a definir dans Parametres'}), le dossier passe en Installation.
      </p>
      <label className="flex items-center gap-2 text-xs text-ink/60 mb-3">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Afficher aussi les dossiers deja positifs
      </label>

      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left text-xs uppercase tracking-wide">
              <th className="px-3 py-2">Date visite</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Telephone</th>
              <th className="px-3 py-2">Commercial</th><th className="px-3 py-2">Statut papiers</th>
              <th className="px-3 py-2">Retour du commercial</th><th className="px-3 py-2">Documents</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-ink/40">Aucun dossier.</td></tr>}
            {shown.map((r) => {
              const st = statutOf(r);
              const color = colorForName(st, statuts);
              const docs = (files[r.id] || []).filter((f) => f.kind === 'papiers');
              return (
                <Fragment key={r.id}>
                  <tr className={`border-t border-black/5 hover:bg-forest-light/40 align-top ${isPositif(r) ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-3 py-2 font-medium">{r.client || r.raison_sociale || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.telephone || '—'}</td>
                    <td className="px-3 py-2">{r.commercial || '—'}</td>
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
                          <textarea value={pComment} onChange={(e) => setPComment(e.target.value)} rows={2} placeholder="Commentaire du commercial..." className="w-full text-xs border rounded px-2 py-1" />
                          <div className="flex gap-3">
                            <button onClick={() => confirmStatut(r)} disabled={busy} className="text-forest text-xs font-semibold hover:underline disabled:opacity-50">{busy ? '...' : 'Valider'}</button>
                            <button onClick={() => setPending(null)} className="text-ink/40 text-xs hover:underline">Annuler</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[220px]">
                      {canEdit ? (
                        <textarea defaultValue={r.papiers_commentaire || ''} key={`c${r.id}${r.papiers_commentaire}`} rows={2}
                          onBlur={(e) => saveComment(r, e.target.value)} placeholder="Commentaire..."
                          className="w-full text-xs border rounded px-2 py-1 whitespace-normal" />
                      ) : <span className="text-xs text-ink/70 whitespace-normal">{r.papiers_commentaire || '—'}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {docs.map((f) => (
                        <div key={f.id} className="flex items-center gap-1">
                          <a href={`/api/rdv-files/${f.id}`} target="_blank" rel="noreferrer" className="text-forest underline">📎 {f.filename}</a>
                          {canEdit && <button onClick={() => removeFile(f)} className="text-statut-annule" title="Supprimer">×</button>}
                        </div>
                      ))}
                      {canEdit && (
                        <button onClick={() => { uploadFor.current = r.id; fileInput.current?.click(); }} disabled={uploadingId === r.id}
                          className="text-forest font-semibold hover:underline mt-1">
                          {uploadingId === r.id ? 'Envoi...' : '+ Joindre'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} className="text-xs font-semibold text-forest hover:underline">
                        {open[r.id] ? 'Masquer' : 'Historique'}
                      </button>
                    </td>
                  </tr>
                  {open[r.id] && (
                    <tr className="bg-forest-light/30"><td colSpan={8} className="px-4 py-3 max-w-xl"><StatusTimeline entityType="rdv" entityId={r.id} /></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
