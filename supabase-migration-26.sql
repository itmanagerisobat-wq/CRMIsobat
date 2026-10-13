-- A executer dans Supabase -> SQL Editor -> New query -> Run

create table if not exists commercial_zones (
  id uuid primary key default gen_random_uuid(),
  commercial text not null,
  region_code text not null,
  created_at timestamptz default now()
);
create index if not exists commercial_zones_commercial_idx on commercial_zones (commercial);
alter table commercial_zones enable row level security;

-- Nombre max de RDV par commercial et par jour (le meme parametre existant,
-- desormais interprete par commercial et non plus au global)
insert into parametres (key, values) values
  ('max_rdv_par_jour', array['3'])
on conflict (key) do nothing;

alter table rdv_requests add column if not exists adresse text;
alter table rdv_requests add column if not exists operation text;

update parametres set values = array['Raison sociale','Responsable','Telephone','Adresse','Operation']
where key = 'champs_prise_rdv_agent'
  and not (values @> array['Adresse']);

alter table rdv_requests drop constraint if exists rdv_requests_status_check;
alter table rdv_requests add constraint rdv_requests_status_check check (status in ('pending','validated','refused','cancelled'));
