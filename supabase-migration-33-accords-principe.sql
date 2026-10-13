-- A executer dans Supabase -> SQL Editor -> New query -> Run

create table if not exists accords_principe (
  id uuid primary key default gen_random_uuid(),
  raison_sociale text,
  client text,
  telephone text,
  adresse text,
  operation text,
  agent_id uuid references agent_pins(id) on delete set null,
  agent_name text,
  statut text,
  commentaire text,
  type_client text not null default 'b2b' check (type_client in ('b2b', 'b2c')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists accords_principe_agent_idx on accords_principe (agent_id);
create index if not exists accords_principe_statut_idx on accords_principe (statut);
create index if not exists accords_principe_type_client_idx on accords_principe (type_client);

insert into parametres (key, values) values
  ('statuts_ap', array['A rappeler', 'Devis envoye', 'En negociation', 'Signe', 'Perdu'])
on conflict (key) do nothing;
