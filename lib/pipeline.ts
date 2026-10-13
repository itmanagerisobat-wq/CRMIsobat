import { Rdv } from './types';
import { textIncludes } from './text-match';

export type Phase = 'qualite' | 'affectation' | 'visite' | 'retour' | 'closed';

/** Derives the current pipeline phase of a RDV purely from its existing
 * fields -- no separate "phase" field needs to be maintained by hand. */
export function computePhase(rdv: Partial<Rdv>): Phase {
  if (textIncludes(rdv.qualite_resultat, 'ferm') || textIncludes(rdv.statut, 'ferm')) return 'closed';
  if (rdv.qualite_non_conforme) return 'closed';
  if (rdv.qualite_annule) return 'closed';
  if (rdv.statut === 'Annule') return 'closed';
  // B2C : pas de phase Qualite (la confirmation du RDV s'est faite avant son arrivee au Planning)
  const qualiteResolved = rdv.type_client === 'b2c' || textIncludes(rdv.qualite_resultat, 'confirme') || textIncludes(rdv.qualite_resultat, 'reporte');
  if (!qualiteResolved) return 'qualite'; // undecided (injoignable, reflexion...) stays here
  if (!rdv.commercial) return 'affectation';
  if (rdv.statut !== 'honore') return 'affectation'; // stays here (whatever its statut) until honore
  return 'retour'; // honore -- always shown here, whether or not the sous-statut/compte-rendu is filled yet
}

export const PHASE_LABELS: Record<Phase, string> = {
  qualite: 'Qualite',
  affectation: 'Affectation',
  visite: 'Visite',
  retour: 'Retour commercial',
  closed: 'Cloture',
};

export const PHASE_ORDER: Phase[] = ['qualite', 'affectation', 'visite', 'retour'];
