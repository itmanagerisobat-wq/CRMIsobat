'use client';

import { useEffect, useState, useRef } from 'react';
import { Rdv } from '@/lib/types';
import PhasePopup from './phase-popup';
import { useUnivers } from '@/lib/use-univers';

interface Props {
  params: Record<string, string[]>;
  canEdit: boolean;
}

export default function AujourdhuiBanner({ params, canEdit }: Props) {
  const univers = useUnivers();
  const univRef = useRef(univers);
  univRef.current = univers;
  const [rows, setRows] = useState<Rdv[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<Rdv | null>(null);

  async function load() {
    const res = await fetch('/api/rdv', { cache: 'no-store' });
    const json = await res.json();
    if (univRef.current !== univers) return;
    setRows((json.data || []).filter((r: Rdv) => (r.type_client || 'b2b') === univers));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [univers]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRdvs = rows
    .filter((r) => r.date && r.date.slice(0, 10) === today && !r.statut)
    .sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));

  if (loading || todayRdvs.length === 0) return null;

  return (
    <div className="bg-gold-light border-2 border-gold/40 rounded-lg mb-4 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm bg-gold/10"
      >
        <span>
          📅 <strong>{todayRdvs.length}</strong> RDV aujourd'hui en attente de retour
        </span>
        <span className="text-xs text-ink/50">{open ? 'Reduire ▲' : 'Voir ▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gold/20 text-ink/70 text-left">
                <th className="px-3 py-2 font-semibold text-xs uppercase">Date</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Heure</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Operation</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Prestataire</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Commercial</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Adresse</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Statut</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Raison sociale</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase">Commentaire</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {todayRdvs.map((r) => (
                <tr key={r.id} className="border-t border-gold/20 bg-white hover:bg-gold-light/40">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.date!).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.heure || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.operation || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.prestataire || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.commercial || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.adresse || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ink/10 text-ink/60">Confirme</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.raison_sociale || r.client || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.motif || '—'}</td>
                  <td className="px-3 py-2">
                    {canEdit && (
                      <button onClick={() => setEditing(r)} className="text-forest hover:underline text-xs">
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <PhasePopup
          rdv={editing}
          params={params}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          intakeOnly
        />
      )}
    </div>
  );
}
