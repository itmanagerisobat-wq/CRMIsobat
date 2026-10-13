-- A executer dans Supabase -> SQL Editor -> New query -> Run

create extension if not exists "pgcrypto";

-- Comptes utilisateurs nominatifs
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  display_name text not null,
  role text not null check (role in ('admin','viewer','relanceur')),
  created_at timestamptz default now(),
  last_login timestamptz
);
alter table users enable row level security;

-- Historique des actions
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_display_name text,
  user_role text,
  action text not null,
  details text,
  created_at timestamptz default now()
);
create index if not exists activity_log_created_idx on activity_log (created_at desc);
alter table activity_log enable row level security;

-- Sauvegardes automatiques
create table if not exists backups (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz default now()
);
create index if not exists backups_created_idx on backups (created_at desc);
alter table backups enable row level security;
