-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table activity_log add column if not exists rdv_id uuid references rdv(id) on delete set null;
create index if not exists activity_log_rdv_idx on activity_log (rdv_id);

alter table rdv add column if not exists agent_name text;

alter table rdv add column if not exists qualite_confirmation boolean;
alter table rdv add column if not exists qualite_criteres_respectes boolean;
alter table rdv add column if not exists qualite_resultat text;
alter table rdv add column if not exists qualite_non_conforme boolean default false;

alter table rdv_requests add column if not exists raison_sociale text;
alter table rdv_requests add column if not exists client text;
alter table rdv_requests add column if not exists telephone text;

insert into parametres (key, values) values
  ('resultat_qualite', array['RDV confirme','KO','Hors cible'])
on conflict (key) do nothing;

insert into parametres (key, values) values
  ('statuts_rdv_non_conforme', array['KO','Hors cible'])
on conflict (key) do nothing;

insert into parametres (key, values) values
  ('champs_prise_rdv_agent', array['Raison sociale','Responsable','Telephone'])
on conflict (key) do nothing;
