-- A executer dans Supabase -> SQL Editor -> New query -> Run

create table if not exists rdv_requests (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  heure text not null,
  code_postal text,
  departement text,
  agent_id uuid references agent_pins(id) on delete set null,
  agent_name text,
  slot_status text,
  status text not null default 'pending' check (status in ('pending','validated','refused')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists rdv_requests_status_idx on rdv_requests (status);
create index if not exists rdv_requests_agent_idx on rdv_requests (agent_id);
alter table rdv_requests enable row level security;
