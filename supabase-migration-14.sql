-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table rdv add column if not exists distance_paris_km numeric;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  raison_sociale text not null,
  adresse text,
  responsable text,
  telephone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists clients_raison_sociale_idx on clients (lower(raison_sociale));
alter table clients enable row level security;
