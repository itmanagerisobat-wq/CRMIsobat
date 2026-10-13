import { textIncludes, normalizeText } from './text-match';

export const FICHE_KEYS = [
  'preconisation', 'residence', 'occupant', 'email', 'nb_personnes', 'revenu_fiscal',
  'type_compteur', 'superficie', 'mode_chauffage', 'emplacement_chaudiere', 'type_radiateurs',
] as const;

export const FICHE_LABELS: Record<string, string> = {
  preconisation: 'Preconisation', residence: 'Maison', occupant: 'Occupant', email: 'Email proprietaire',
  nb_personnes: 'Nb personnes foyer fiscal', revenu_fiscal: 'Revenu fiscal de reference',
  type_compteur: 'Type de compteur', superficie: 'Superficie habitable (m²)', mode_chauffage: 'Mode de chauffage',
  emplacement_chaudiere: 'Emplacement chaudiere', type_radiateurs: 'Type de radiateurs',
};

export const FICHE_OPTIONS: Record<string, string[]> = {
  residence: ['Residence principale', 'Residence secondaire'],
  occupant: ['Proprietaire', 'Locataire'],
  type_compteur: ['Triphase', 'Mono'],
  mode_chauffage: ['Fioul', 'Gaz', 'Bois', 'Electrique'],
  type_radiateurs: ['Fonte', 'Acier', 'Plancher chauffant hydraulique'],
};

export const isConfirme = (s: string | null | undefined) => normalizeText(s).trim() === 'confirme';
export const isReporteConf = (s: string | null | undefined) => textIncludes(s, 'reporte');
export const isAnnuleConf = (s: string | null | undefined) => textIncludes(s, 'annul');
export const isChangementAvis = (s: string | null | undefined) => textIncludes(s, 'changement');

export function cleanFiche(src: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of FICHE_KEYS) {
    const v = src?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = String(v).trim();
  }
  return out;
}


/** Code departement a partir d'un code postal francais (gere la Corse 2A/2B). */
export function deptFromCp(cp: string | null | undefined): string | null {
  const c = String(cp || '').replace(/\s/g, '');
  if (!/^\d{5}$/.test(c)) return null;
  if (c.startsWith('20')) return parseInt(c.slice(0, 3), 10) <= 201 ? '2A' : '2B';
  if (c.startsWith('97') || c.startsWith('98')) return c.slice(0, 3);
  return c.slice(0, 2);
}

/** Visite honoree (attention : "non honore" ne doit pas compter). */
export const isHonore = (s: string | null | undefined) => normalizeText(s).trim() === 'honore';
