'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { colorForName } from '@/lib/palette';
import { isConfirme } from '@/lib/b2c-flow';
import StatusTimeline from './status-timeline';

interface Row {
  id: string; agent_name: string | null; client: string | null; telephone: string | null; adresse: string | null;
  operation: string | null; date: string | null; heure: string | null; commercial: string | null;
  confirmation_statut: string | null; confirmation_commentaire: string | null; valide_at: string | null;
  relance_statut: string | null; relance_commentaire: string | null; relance_date_rappel: string | null;
}

/** B2C : RDV valides mais pas confirmes (a confirmer / annule / reporte / changement d'avis) a relancer jusqu'a l'accord du client. */
export default function ConfirmationsRelance({ canEdit, todayOnly, onCount }: { canEdit: boolean; todayOnly: boolean; onCount?: (n: number) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [statutsRelance, setStatutsRelance] = useState<string[]>([]);
  const [statutsConf, setStatutsConf] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch('/api/b2c-rdv', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((x) => x.json()),
    ]);
    const list: Row[] = (r.data || []).filter((x: Row) => !!x.valide_at && !isConfirme(x.confirmation_statut));
    setRows(list);
    onCount?.(list.length);
    setStatutsRelance(p.data?.statuts_relance || []);
    setStatutsConf(p.data?.statuts_confirmation_b2c || []);
    setLoading(false);
  }, [onCount]);
  useEffect(() => { load(); }, [load]);

  async function patch(id: string, body: Record<string, any>) {
    const res = await fetch(`/api/b2c-rdv/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    load();
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const shown = rows.filter((r) => !todayOnly || String(r.relance_date_rappel || '').slice(0, 10) === todayIso);

  return (
    <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-forest-light text-forest-dark text-left text-xs uppercase tracking-wide">
            <th className="px-3 py-2">Client</th><th className="px-3 py-2">Telephone</th><th className="px-3 py-2">RDV</th>
            <th className="px-3 py-2">Commercial</th><th className="px-3 py-2">Confirmation</th>
            <th className="px-3 py-2">Statut relance</th><th className="px-3 py-2">Rappel</th><th className="px-3 py-2">Commentaire</th><th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={9} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
          {!loading && shown.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-ink/40">Aucun RDV a relancer pour la confirmation.</td></tr>}
          {shown.map((r) => {
            const cs = r.confirmation_statut || '';
            return (
              <Fragment key={r.id}>
                <tr className="border-t border-black/5 hover:bg-forest-light/40 align-top">
                  <td className="px-3 py-2 font-medium">{r.client || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.telephone || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'} {r.heure || ''}</td>
                  <td className="px-3 py-2">{r.commercial || '—'}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select value={cs} onChange={(e) => patch(r.id, { confirmation_statut: e.target.value })} className="text-xs border rounded px-1.5 py-1"
                        style={{ borderColor: colorForName(cs, statutsConf), color: colorForName(cs, statutsConf), fontWeight: 600 }}>
                        {statutsConf.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : cs}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select value={r.relance_statut || ''} onChange={(e) => patch(r.id, { relance_statut: e.target.value || null })} className="text-xs border rounded px-1.5 py-1">
                        <option value="">— a definir —</option>
                        {statutsRelance.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (r.relance_statut || '—')}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input type="date" defaultValue={r.relance_date_rappel ? String(r.relance_date_rappel).slice(0, 10) : ''} key={`r${r.id}${r.relance_date_rappel}`}
                        onBlur={(e) => { if (e.target.value !== (r.relance_date_rappel ? String(r.relance_date_rappel).slice(0, 10) : '')) patch(r.id, { relance_date_rappel: e.target.value || null }); }}
                        className="text-xs border rounded px-1.5 py-1" />
                    ) : (r.relance_date_rappel ? new Date(r.relance_date_rappel).toLocaleDateString('fr-FR') : '—')}
                  </td>
                  <td className="px-3 py-2 min-w-[200px]">
                    {canEdit ? (
                      <textarea defaultValue={r.relance_commentaire || ''} key={`c${r.id}${r.relance_commentaire}`} rows={2}
                        onBlur={(e) => { if (e.target.value !== (r.relance_commentaire || '')) patch(r.id, { relance_commentaire: e.target.value || null }); }}
                        placeholder="Commentaire de relance..." className="w-full text-xs border rounded px-2 py-1 whitespace-normal" />
                    ) : <span className="text-xs text-ink/70 whitespace-normal">{r.relance_commentaire || '—'}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} className="text-xs font-semibold text-forest hover:underline">
                      {open[r.id] ? 'Masquer' : 'Historique'}
                    </button>
                  </td>
                </tr>
                {open[r.id] && (
                  <tr className="bg-forest-light/30"><td colSpan={9} className="px-4 py-3 max-w-xl"><StatusTimeline entityType="b2c" entityId={r.id} /></td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
