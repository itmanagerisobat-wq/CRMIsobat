-- Migration 41 : B2C v2 (Planning unifie, calendrier PAC, papiers par resultat de visite, installation manuelle, relance des confirmations)

-- 1) Installations saisies a la main (infos recues de la boite)
create table if not exists b2c_installations (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  telephone text,
  adresse text,
  date_installation date,
  statut text,
  commentaire text,
  rdv_id uuid,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table b2c_installations enable row level security;

-- 2) Relance des RDV B2C non confirmes (annule / changement d'avis / reporte / a confirmer)
alter table rdv_requests add column if not exists relance_statut text;
alter table rdv_requests add column if not exists relance_commentaire text;
alter table rdv_requests add column if not exists relance_date_rappel date;

-- 3) Parametres
-- RDV PAC saisis depuis le calendrier B2B (ils vivent dans le Planning B2C, visibles aussi dans le calendrier B2B)
alter table rdv add column if not exists is_pac boolean not null default false;

insert into parametres (key, values) values
  ('visite_vers_papiers', array['Devis signe','Papiers recuperes'])
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- 4) Les RDV B2C du Planning n'ont pas de phase "Qualite" (la confirmation s'est faite avant) : on les marque confirmes
update rdv set qualite_resultat = 'Confirme' where type_client = 'b2c' and (qualite_resultat is null or qualite_resultat = '');
