-- A executer dans Supabase -> SQL Editor -> New query -> Run

-- Nouveau role "gestionnaire" (comme Admin, mais sans Parametres/Utilisateurs/Sauvegarde)
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin','gestionnaire','viewer','relanceur','agent'));

-- Fiche client : B2B / B2C + informations de site parametrables
alter table clients add column if not exists type text not null default 'b2b' check (type in ('b2b','b2c'));
alter table clients add column if not exists nom text;
alter table clients add column if not exists prenom text;
alter table clients add column if not exists site_info jsonb default '{}'::jsonb;

-- Liste des champs "Informations de site" (definis par toi, dans Parametres)
insert into parametres (key, values) values
  ('champs_site', array['Surface (m2)','Hauteur sous plafond (m)'])
on conflict (key) do nothing;

-- Agents de prospection identifies par Nom + code PIN (pas de compte complet
-- necessaire) -- ils se connectent avec le mot de passe partage "agent" puis
-- choisissent leur nom + tapent leur PIN.
create table if not exists agent_pins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  created_at timestamptz default now()
);
alter table agent_pins enable row level security;
