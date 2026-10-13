-- A executer dans Supabase -> SQL Editor -> New query -> Run

-- Suivi des imports (pour pouvoir les retrouver et les supprimer individuellement)
create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text,
  row_count int not null default 0,
  months text[],
  created_at timestamptz default now()
);
alter table import_batches enable row level security;

alter table rdv add column if not exists import_batch_id uuid references import_batches(id) on delete set null;

-- Parametre : seuil de trajet max entre 2 RDV pour la page Disponibilites (en minutes)
insert into parametres (key, values) values
  ('temps_trajet_max', array['90'])
on conflict (key) do nothing;

-- Autoriser le nouveau role "agent" sur les comptes nominatifs
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin','viewer','relanceur','agent'));
