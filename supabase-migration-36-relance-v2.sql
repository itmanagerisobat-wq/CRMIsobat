-- A executer dans Supabase -> SQL Editor -> New query -> Run

-- Relance : commentaire + date de rappel
alter table rdv add column if not exists relance_commentaire text;
alter table rdv add column if not exists relance_date_rappel date;

-- Accords de principe : commentaire du relanceur
alter table accords_principe add column if not exists relanceur_commentaire text;

-- Pieces jointes (devis envoye / NDD) stockees en base
create table if not exists rdv_files (
  id uuid primary key default gen_random_uuid(),
  rdv_id uuid references rdv(id) on delete cascade,
  kind text not null check (kind in ('devis','ndd')),
  filename text not null,
  mime text,
  size integer,
  data bytea not null,
  uploaded_by text,
  created_at timestamptz default now()
);
create index if not exists rdv_files_rdv_idx on rdv_files (rdv_id);
alter table rdv_files enable row level security;

-- Historique de tracabilite de tous les changements de statut
create table if not exists status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,   -- 'rdv' | 'ap'
  entity_id text not null,
  field text not null,         -- 'statut' | 'sous_statut' | 'statut_relance' | 'statut_ap'
  old_value text,
  new_value text,
  comment text,
  user_display_name text,
  created_at timestamptz default now()
);
create index if not exists status_history_entity_idx on status_history (entity_type, entity_id, created_at desc);
alter table status_history enable row level security;

notify pgrst, 'reload schema';
