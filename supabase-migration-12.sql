-- A executer dans Supabase -> SQL Editor -> New query -> Run

create table if not exists objectifs (
  id uuid primary key default gen_random_uuid(),
  commercial text not null,
  month text not null,
  target_rdv int not null default 0,
  unique(commercial, month)
);
alter table objectifs enable row level security;
