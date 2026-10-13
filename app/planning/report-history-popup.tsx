'use client';

import { useEffect, useState } from 'react';
import { Rdv } from '@/lib/types';

interface LogRow {
  id: string;
  user_display_name: string | null;
  details: string | null;
  created_at: string;
}

interface ParsedReport {
  raw: LogRow;
  numero: string;
  commercial: string;
  ancienneDate: string;
  ancienCommentaire: string;
}

function parseReport(l: LogRow): ParsedReport {
  const d = l.details || '';
  const numero = /Report #(\d+)/.exec(d)?.[1] || '?';
  const commercial = /commercial : ([^-]+?)(?: --|$)/.exec(d)?.[1]?.trim() || '—';
  const ancienneDate = /ancienne date : ([^-]+?)(?: --|$)/.exec(d)?.[1]?.trim() || '—';
  const ancienCommentaire = /ancien commentaire : "([^"]*)"/.exec(d)?.[1] || '';
  return { raw: l, numero, commercial, ancienneDate, ancienCommentaire };
}

export default function ReportHistoryPopup({ rdv, onClose }: { rdv: Rdv; onClose: () => void }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activity?rdv_id=${rdv.id}&limit=200`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setLogs((j.data || []).filter((l: LogRow) => (l.details || '').includes('Report #'))))
      .finally(() => setLoading(false));
  }, [rdv.id]);

  const reports = logs.map(parseReport);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-lg">Historique des reports</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/50 mb-3">
          {rdv.raison_sociale || rdv.client || 'Client non precise'} · {(rdv.nombre_reports || 0)} report{(rdv.nombre_reports || 0) > 1 ? 's' : ''} au total
        </p>

        {loading && <p className="text-xs text-ink/40">Chargement...</p>}
        {!loading && reports.length === 0 && <p className="text-xs text-ink/40 italic">Aucun report enregistre pour ce RDV.</p>}

        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {reports.map((r) => (
            <li key={r.raw.id} className="border border-black/10 rounded-md p-2.5 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-purple-700">Report #{r.numero}</span>
                <span className="text-ink/40">{new Date(r.raw.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="text-ink/70">
                <span className="font-medium">Ancienne date :</span> {r.ancienneDate}
              </div>
              <div className="text-ink/70">
                <span className="font-medium">Commercial a ce moment-la :</span> {r.commercial}
              </div>
              {r.ancienCommentaire && (
                <div className="text-ink/70">
                  <span className="font-medium">Commentaire :</span> {r.ancienCommentaire}
                </div>
              )}
              <div className="text-ink/30 mt-1">Modifie par {r.raw.user_display_name || '—'}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
