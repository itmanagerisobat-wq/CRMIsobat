-- A executer dans Supabase -> SQL Editor -> New query -> Run

create table if not exists commercial_base (
  commercial text primary key,
  code_postal text not null,
  updated_at timestamptz default now()
);
alter table commercial_base enable row level security;

insert into parametres (key, values) values
  ('heure_debut_journee', array['08h00'])
on conflict (key) do nothing;

insert into parametres (key, values) values
  ('heure_fin_journee', array['18h00'])
on conflict (key) do nothing;
