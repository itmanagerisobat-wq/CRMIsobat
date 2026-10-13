-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table rdv add column if not exists qualite_statut text check (qualite_statut in ('ok','ko','en_attente'));
alter table rdv add column if not exists qualite_commentaire text;
alter table rdv add column if not exists qualite_resultats jsonb default '{}'::jsonb;

-- Criteres de qualite, parametrables par operation (peuvent changer avec le temps)
create table if not exists qualite_criteres_ref (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  critere text not null,
  created_at timestamptz default now()
);
create index if not exists qualite_criteres_ref_operation_idx on qualite_criteres_ref (operation);
alter table qualite_criteres_ref enable row level security;
