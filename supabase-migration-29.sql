-- A executer dans Supabase -> SQL Editor -> New query -> Run

insert into parametres (key, values) values
  ('correspondance_couleurs_import', array[]::text[])
on conflict (key) do nothing;

insert into parametres (key, values) values
  ('statuts_visite', array['non honore','honore','Reporte','Annule','Non confirme'])
on conflict (key) do nothing;

insert into parametres (key, values) values
  ('statuts_import_couleur', array['honore','non honore','Reporte','Annule','Non confirme','RDV confirme'])
on conflict (key) do nothing;

alter table rdv add column if not exists qualite_annule boolean not null default false;

alter table rdv add column if not exists qualite_dernier_appel timestamptz;

alter table clients add column if not exists fonction_responsable text;
alter table rdv add column if not exists fonction_responsable text;


insert into parametres (key, values) values
  ('operations_fermees', array[]::text[])
on conflict (key) do nothing;

alter table rdv add column if not exists deleted_at timestamptz;

insert into parametres (key, values) values
  ('couleurs_sous_statuts', array['Devis signe=green','Devis envoye=blue','KO=red','En cours de verification=orange'])
on conflict (key) do nothing;
