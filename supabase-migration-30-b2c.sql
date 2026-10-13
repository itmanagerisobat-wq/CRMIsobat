-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table rdv add column if not exists type_client text not null default 'b2b' check (type_client in ('b2b', 'b2c'));

insert into parametres (key, values) values
  ('commerciaux_b2c', array[]::text[])
on conflict (key) do nothing;
