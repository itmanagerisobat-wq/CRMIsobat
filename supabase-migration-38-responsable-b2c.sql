-- A executer dans Supabase -> SQL Editor -> New query -> Run

-- Nouveau role "responsable_b2c"
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin','gestionnaire','viewer','relanceur','responsable_b2c','agent'));

-- Chat : salons nommes (salon commun renommable + salon B2C independant)
create table if not exists chat_rooms (
  id text primary key,
  name text not null
);
insert into chat_rooms (id, name) values ('general', 'Salon commun'), ('b2c', 'Salon B2C')
on conflict (id) do nothing;
alter table chat_rooms enable row level security;

-- Perimetre de chaque personne : b2b / b2c / all (admin, gestionnaire)
alter table chat_presence add column if not exists scope text default 'b2b';

-- Chat : photos
create table if not exists chat_images (
  id uuid primary key default gen_random_uuid(),
  mime text,
  data bytea not null,
  created_at timestamptz default now()
);
alter table chat_images enable row level security;
alter table chat_messages add column if not exists image_id uuid;

notify pgrst, 'reload schema';
