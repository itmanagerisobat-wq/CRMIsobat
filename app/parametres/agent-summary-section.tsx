'use client';

import { useEffect, useState } from 'react';

interface Summary {
  pending: number;
  validated: number;
  refused: number;
}

export default function AgentSummarySection() {
  const [summary, setSummary] = useState<Record<string, Summary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rdv-requests/summary', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setSummary(j.data || {}))
      .finally(() => setLoading(false));
  }, []);

  const names = Object.keys(summary);

  return (
    <div className="bg-white rounded-lg border border-black/5 p-4">
      <h2 className="font-semibold text-ink mb-3">Suivi des demandes par agent</h2>
      {loading && <p className="text-sm text-ink/40">Chargement...</p>}
      {!loading && names.length === 0 && <p className="text-sm text-ink/40 italic">Aucune demande enregistree pour l'instant.</p>}
      {names.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left">
              <th className="px-2 py-1.5 font-semibold text-xs uppercase">Agent</th>
              <th className="px-2 py-1.5 font-semibold text-xs uppercase text-center">En attente</th>
              <th className="px-2 py-1.5 font-semibold text-xs uppercase text-center">Validees</th>
              <th className="px-2 py-1.5 font-semibold text-xs uppercase text-center">Refusees</th>
            </tr>
          </thead>
          <tbody>
            {names.map((name) => (
              <tr key={name} className="border-t border-black/5">
                <td className="px-2 py-1.5 font-medium">{name}</td>
                <td className="px-2 py-1.5 text-center text-gold">{summary[name].pending}</td>
                <td className="px-2 py-1.5 text-center text-statut-honore">{summary[name].validated}</td>
                <td className="px-2 py-1.5 text-center text-statut-annule">{summary[name].refused}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
