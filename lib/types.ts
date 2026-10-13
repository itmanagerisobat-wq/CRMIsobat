export type Statut = 'non honore' | 'honore' | 'Reporte' | 'Annule' | 'Non confirme' | '';

export interface Rdv {
  id: string;
  month: string;
  week_number: number;
  date: string | null;
  heure: string | null;
  operation: string | null;
  prestataire: string | null;
  commercial: string | null;
  departement: string | null;
  code_postal: string | null;
  critere: string | null;
  statut: Statut;
  sous_statut: string | null;
  client: string | null;
  fonction_responsable: string | null;
  deleted_at: string | null;
  type_client: 'b2b' | 'b2c';
  document_statut: string | null;
  document_note: string | null;
  raison_sociale: string | null;
  adresse: string | null;
  telephone: string | null;
  distance_paris_km: number | null;
  compte_rendu: string | null;
  qualite_statut: 'ok' | 'ko' | 'en_attente' | null;
  qualite_commentaire: string | null;
  qualite_resultats: Record<string, boolean> | null;
  qualite_confirmation: boolean | null;
  qualite_criteres_respectes: boolean | null;
  qualite_resultat: string | null;
  qualite_non_conforme: boolean | null;
  qualite_annule: boolean | null;
  qualite_dernier_appel: string | null;
  phase_changee_le: string | null;
  agent_name: string | null;
  nombre_reports: number | null;
  motif: string | null;
  statut_relance: string | null;
  relance_commentaire?: string | null;
  papiers_statut?: string | null;
  papiers_commentaire?: string | null;
  installation_date?: string | null;
  installation_statut?: string | null;
  installation_commentaire?: string | null;
  b2c_fiche?: Record<string, string> | null;
  is_pac?: boolean | null;
  relance_date_rappel?: string | null;
  created_at?: string;
}

export interface AccordPrincipe {
  id: string;
  raison_sociale: string | null;
  client: string | null;
  telephone: string | null;
  adresse: string | null;
  operation: string | null;
  agent_id: string | null;
  agent_name: string | null;
  statut: string | null;
  commentaire: string | null;
  date_prochain_rappel: string | null;
  rdv_envoye_at: string | null;
  relanceur_commentaire?: string | null;
  type_client: 'b2b' | 'b2c';
  created_at: string;
  updated_at: string;
}

export interface RelanceLogEntry {
  id: string;
  rdv_id: string;
  agent: string | null;
  commentaire: string;
  date_prochain_contact: string | null;
  created_at: string;
}

export const MONTHS = [
  'Aout 2026', 'Septembre 2026', 'Octobre 2026', 'Novembre 2026', 'Decembre 2026',
  'Janvier 2027', 'Fevrier 2027', 'Mars 2027', 'Avril 2027', 'Mai 2027',
  'Juin 2027', 'Juillet 2027',
];

export const CORE_STATUTS = ['non honore', 'honore', 'Reporte', 'Annule', 'Non confirme'];

export const STATUT_COLORS: Record<string, string> = {
  'non honore': '#2196F3',
  honore: '#00B050',
  Reporte: '#8B2FE0',
  Annule: '#E4032E',
  'Non confirme': '#FF9800',
};

export const STATUT_LABELS: Record<string, string> = {
  'non honore': 'Non honore',
  honore: 'Honore',
  Reporte: 'Reporte',
  Annule: 'Annule',
  'Non confirme': 'Non confirme',
};
