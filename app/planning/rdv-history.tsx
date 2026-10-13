'use client';

import { useEffect, useState } from 'react';

interface LogRow {
  id: string;
  user_display_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create_rdv: 'RDV cree',
  update_rdv: 'RDV modifie',
  delete_rdv: 'RDV supprime',
  restore_backup: 'Sauvegarde restauree',
};

export default function RdvHistory({ rdvId }: { rdvId: string }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activity?rdv_id=${rdvId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setLogs(j.data || []))
      .finally(() => setLoading(false));
  }, [rdvId]);

  return (
    <div className="bg-ink/5 rounded-lg p-3 max-h-52 overflow-y-auto">
      {loading && <p className="text-xs text-ink/40">Chargement...</p>}
      {!loading && logs.length === 0 && <p className="text-xs text-ink/40 italic">Aucun historique.</p>}
      <ul className="space-y-1.5">
        {logs.map((l) => (
          <li key={l.id} className="text-xs">
            <span className="text-ink/40">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
            {' — '}
            <span className="font-medium">{l.user_display_name || '—'}</span>
            {' : '}
            {ACTION_LABELS[l.action] || l.action}
            {l.details ? ` (${l.details})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
