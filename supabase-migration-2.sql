-- Migration : ajoute le sous-statut (visible uniquement quand Statut = Honore)
-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table rdv add column if not exists sous_statut text;

insert into parametres (key, values) values
  ('sous_statuts', array['Devis signe','KO','Reporte','En cours de verification'])
on conflict (key) do nothing;
