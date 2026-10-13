-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table rdv add column if not exists phase_changee_le timestamptz default now();

insert into parametres (key, values) values
  ('seuil_alerte_phase_heures', array['24'])
on conflict (key) do nothing;
