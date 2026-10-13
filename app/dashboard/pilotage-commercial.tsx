'use client';

import { Rdv } from '@/lib/types';

interface Props {
  rows: Rdv[]; // already scoped to the selected period
  month: string;
  commerciauxList: string[];
}

export default function PilotageCommercial({ rows, month, commerciauxList }: Props) {
  const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

  const ranking = commerciauxList
    .map((c) => {
      const mine = rows.filter((r) => norm(r.commercial) === norm(c));
      const total = mine.length;
      const honore = mine.filter((r) => r.statut === 'honore').length;
      const devisSigne = mine.filter((r) => r.sous_statut === 'Devis signe').length;
      const taux = total ? Math.round((honore / total) * 100) : 0;
      return { commercial: c, total, honore, devisSigne, taux };
    })
    .sort((a, b) => b.taux - a.taux || b.total - a.total);

  const kmParcourus = commerciauxList
    .map((c) => ({
      commercial: c,
      km: rows.filter((r) => norm(r.commercial) === norm(c)).reduce((sum, r) => sum + (r.distance_paris_km || 0), 0),
    }))
    .sort((a, b) => b.km - a.km);
  const maxKm = Math.max(1, ...kmParcourus.map((k) => k.km));

  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

  return (
    <div className="grid lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-white rounded-lg border border-black/5 p-4">
        <h2 className="font-semibold text-ink mb-3">Classement commerciaux</h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-ink/40">Pas de donnees.</p>
        ) : (
          <ul className="space-y-2">
            {ranking.map((r, i) => (
              <li key={r.commercial} className="flex items-center gap-3">
                <span className="w-6 text-center text-lg">{medals[i] || ''}</span>
                <span className="w-24 font-medium text-sm">{r.commercial}</span>
                <div className="flex-1 bg-forest-light rounded-full h-2.5 overflow-hidden">
                  <div className="bg-forest h-full rounded-full" style={{ width: `${r.taux}%` }} />
                </div>
                <span className="text-xs text-ink/60 w-32 text-right">
                  {r.taux}% honore ({r.honore}/{r.total}) · {r.devisSigne} signe(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg border border-black/5 p-4">
        <h2 className="font-semibold text-ink mb-3">Kilometres parcourus ({month})</h2>
        {kmParcourus.length === 0 ? (
          <p className="text-sm text-ink/40">Pas de donnees.</p>
        ) : (
          <ul className="space-y-2">
            {kmParcourus.map((k) => (
              <li key={k.commercial} className="flex items-center gap-3">
                <span className="w-24 font-medium text-sm">{k.commercial}</span>
                <div className="flex-1 bg-gold-light rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gold h-full rounded-full" style={{ width: `${Math.round((k.km / maxKm) * 100)}%` }} />
                </div>
                <span className="text-xs text-ink/60 w-20 text-right">{Math.round(k.km)} km</span>
              </li>
            ))}
            {commerciauxList.length === 0 && (
              <p className="text-sm text-ink/40">Aucun commercial dans Parametres.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
