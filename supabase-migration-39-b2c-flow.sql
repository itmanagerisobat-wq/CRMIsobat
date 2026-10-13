-- A executer dans Supabase -> SQL Editor -> New query -> Run
-- Circuit B2C : fiche agent -> Confirmation -> Planning -> Recuperation des papiers -> Installation

-- 1) Demandes de RDV saisies a la main (sans creneau)
alter table rdv_requests alter column date drop not null;
alter table rdv_requests alter column heure drop not null;
alter table rdv_requests add column if not exists flow text not null default 'slot';   -- 'slot' (creneaux B2B) | 'manual' (B2C)
alter table rdv_requests add column if not exists fiche jsonb;
alter table rdv_requests add column if not exists confirmation_statut text;
alter table rdv_requests add column if not exists confirmation_commentaire text;
alter table rdv_requests add column if not exists commercial text;
alter table rdv_requests add column if not exists rdv_id uuid;
alter table rdv_requests add column if not exists updated_at timestamptz default now();
create index if not exists rdv_requests_flow_idx on rdv_requests (flow);

-- 2) RDV : fiche B2C, recuperation des papiers, installation
alter table rdv add column if not exists b2c_fiche jsonb;
alter table rdv add column if not exists papiers_statut text;
alter table rdv add column if not exists papiers_commentaire text;
alter table rdv add column if not exists installation_date date;
alter table rdv add column if not exists installation_statut text;
alter table rdv add column if not exists installation_commentaire text;

-- 3) Pieces jointes : on autorise plusieurs "papiers" par dossier
alter table rdv_files drop constraint if exists rdv_files_kind_check;
alter table rdv_files add constraint rdv_files_kind_check check (kind in ('devis','ndd','papiers'));

-- 4) Parametres (modifiables ensuite dans la page Parametres)
insert into parametres (key, values) values
  ('statuts_confirmation_b2c', array['A confirmer','Confirme','Annule','Reporte','Changement d avis']),
  ('preconisations_b2c', array['PAC AIR/EAU']),
  ('sous_statuts_papiers', array['Devis signe']),
  ('statuts_papiers', array['En attente des papiers','Recus','Incomplets','Abandon']),
  ('statuts_papiers_ok', array['Recus']),
  ('statuts_installation', array['A planifier','Planifie','Installe','Reporte','Annule'])
on conflict (key) do nothing;

notify pgrst, 'reload schema';
