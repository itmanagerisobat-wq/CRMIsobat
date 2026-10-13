-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table rdv add column if not exists statut_relance text;

create table if not exists relance_log (
  id uuid primary key default gen_random_uuid(),
  rdv_id uuid references rdv(id) on delete cascade,
  agent text,
  commentaire text,
  created_at timestamptz default now()
);
create index if not exists relance_log_rdv_idx on relance_log (rdv_id);
alter table relance_log enable row level security;

insert into parametres (key, values) values
  ('statuts_relance', array['Devis en attente','Devis envoye','Relance en cours','A rappeler','Injoignable','Refus'])
on conflict (key) do nothing;
