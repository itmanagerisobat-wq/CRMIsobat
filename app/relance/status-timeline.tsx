'use client';

import { useEffect, useState } from 'react';

interface Row {
  id: string; field: string; old_value: string | null; new_value: string | null;
  comment: string | null; user_display_name: string | null; created_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  statut: 'Statut visite', sous_statut: 'Sous-statut', statut_relance: 'Relance', statut_ap: 'Accord de principe', confirmation: 'Confirmation', papiers_statut: 'Papiers', installation_statut: 'Installation', date_rdv: 'Date du RDV',
};

/** Chronologie de tous les changements de statut d'un RDV / accord de principe. */
export default function StatusTimeline({ entityType, entityId }: { entityType: 'rdv' | 'ap' | 'b2c'; entityId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`/api/status-history?entity_type=${entityType}&entity_id=${entityId}`, { cache: 'no-store' })
      .then((r) => r.json()).then((j) => setRows(j.data || [])).catch(() => setRows([]));
  }, [entityType, entityId]);

  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-ink/60 mb-1">Tracabilite des statuts</div>
      {rows === null && <p className="text-xs text-ink/40">Chargement...</p>}
      {rows && rows.length === 0 && <p className="text-xs text-ink/40 italic">Aucun changement de statut enregistre.</p>}
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {(rows || []).map((h) => (
          <li key={h.id} className="text-xs bg-white rounded px-2 py-1.5 border border-black/5">
            <div className="flex justify-between text-ink/50">
              <span>{FIELD_LABEL[h.field] || h.field} · {h.user_display_name || '—'}</span>
              <span>{new Date(h.created_at).toLocaleString('fr-FR')}</span>
            </div>
            <div>
              <span className="text-ink/50">{h.old_value || '—'}</span> → <strong>{h.new_value || '—'}</strong>
            </div>
            {h.comment && <div className="text-ink/70 italic">{h.comment}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
