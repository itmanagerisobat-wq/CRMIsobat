'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Row {
  id: string; created_at: string; agent_name: string | null; client: string | null; telephone: string | null;
  code_postal: string | null; operation: string | null; date: string | null; heure: string | null;
  commercial: string | null; valide_at: string | null;
}

/** Equivalent B2C du bandeau « demandes en attente » : pas de creneau, la responsable fixe date / heure / commercial a la main. */
export default function B2cDemandesBanner({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [commerciaux, setCommerciaux] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch('/api/b2c-rdv', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((x) => x.json()),
    ]);
    setRows((r.data || []).filter((x: Row) => !x.valide_at));
    setCommerciaux(p.data?.commerciaux_b2c || []);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  async function patch(id: string, body: Record<string, any>) {
    const res = await fetch(`/api/b2c-rdv/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return false; }
    await load();
    return true;
  }

  async function valider(r: Row) {
    if (!r.date || !r.heure) { alert('Renseigne la date et l\'heure avant de valider.'); return; }
    setBusyId(r.id);
    const ok = await patch(r.id, { action: 'valider' });
    setBusyId(null);
    if (ok) { window.dispatchEvent(new Event('rdv-requests-changed')); onChange?.(); }
  }

  if (rows.length === 0) return null;
  return (
    <div className="bg-lime-50 border border-lime-300 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink">
          🔔 <strong>{rows.length}</strong> demande(s) de RDV en attente (agents de prospection B2C)
          <button onClick={() => setOpen((o) => !o)} className="ml-3 text-xs text-ink/50 hover:underline">{open ? 'Reduire ▲' : 'Afficher ▼'}</button>
        </div>
        <Link href="/rdv-agents" className="text-xs font-semibold text-forest hover:underline">Fiches completes →</Link>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-white border border-black/5 rounded-md px-3 py-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{r.client || '—'}</span>
              <span className="text-ink/60">{r.telephone || ''}</span>
              <span className="text-ink/60">{r.code_postal || ''}{r.operation ? ` · ${r.operation}` : ''}</span>
              <span className="text-xs text-ink/50">Agent : {r.agent_name || '—'}</span>
              <span className="flex-1" />
              <input type="date" defaultValue={r.date ? String(r.date).slice(0, 10) : ''} key={`d${r.id}${r.date}`}
                onBlur={(e) => { if (e.target.value !== (r.date ? String(r.date).slice(0, 10) : '')) patch(r.id, { date: e.target.value || null }); }}
                className="text-xs border rounded px-1.5 py-1" />
              <input type="time" defaultValue={r.heure || ''} key={`h${r.id}${r.heure}`}
                onBlur={(e) => { if (e.target.value !== (r.heure || '')) patch(r.id, { heure: e.target.value || null }); }}
                className="text-xs border rounded px-1.5 py-1" />
              <select value={r.commercial || ''} onChange={(e) => patch(r.id, { commercial: e.target.value || null })} className="text-xs border rounded px-1.5 py-1">
                <option value="">— commercial —</option>
                {commerciaux.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => valider(r)} disabled={busyId === r.id}
                className="bg-forest hover:bg-forest-dark text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50">
                Valider
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
