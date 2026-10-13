'use client';

import { Rdv } from '@/lib/types';
import { computePhase, PHASE_ORDER, Phase } from '@/lib/pipeline';

interface Props {
  rdv: Rdv;
  seuilHeures: number;
}

function dotColor(phaseIdx: number, currentIdx: number, closed: boolean, closedReason: 'ko' | 'annule' | null, reporte: boolean): string {
  if (closed && closedReason && phaseIdx === currentIdx) return 'bg-statut-annule';
  if (reporte && phaseIdx === currentIdx) return 'bg-orange-400';
  if (phaseIdx < currentIdx) return 'bg-statut-honore';
  if (phaseIdx === currentIdx) return 'bg-gold';
  return 'bg-ink/15';
}

export default function Parcours({ rdv, seuilHeures }: Props) {
  const phase = computePhase(rdv);
  const closedReason: 'ko' | 'annule' | null =
    rdv.qualite_non_conforme ? 'ko' : rdv.statut === 'Annule' ? 'annule' : null;
  const reporte = rdv.statut === 'Reporte';

  // if fully closed with a result (sous_statut present), treat all 4 as done
  const currentIdx = phase === 'closed' && !closedReason
    ? PHASE_ORDER.length
    : PHASE_ORDER.indexOf(phase as Phase);

  const changedAt = rdv.phase_changee_le ? new Date(rdv.phase_changee_le) : null;
  const hoursIn = changedAt ? (Date.now() - changedAt.getTime()) / 36e5 : 0;
  const isLate = !closedReason && phase !== 'closed' && hoursIn >= seuilHeures;

  return (
    <div className="flex items-center gap-0.5" title={PHASE_ORDER.map((p, i) => `${i + 1}. ${p}`).join(' ')}>
      {PHASE_ORDER.map((p, i) => (
        <div key={p} className="flex items-center">
          <span
            className={`w-2.5 h-2.5 rounded-full ${dotColor(i, currentIdx, !!closedReason, closedReason, reporte)} ${isLate && i === currentIdx ? 'ring-2 ring-statut-annule ring-offset-1' : ''}`}
          />
          {i < PHASE_ORDER.length - 1 && (
            <span className={`w-3 h-0.5 ${i < currentIdx ? 'bg-statut-honore' : 'bg-ink/15'}`} />
          )}
        </div>
      ))}
      {closedReason && (
        <span className="ml-1 text-[10px] text-statut-annule font-medium">{closedReason === 'ko' ? 'KO' : 'Annule'}</span>
      )}
      {isLate && (
        <span className="ml-1 text-[10px] text-statut-annule font-medium">⚠️ {Math.floor(hoursIn)}h</span>
      )}
    </div>
  );
}
