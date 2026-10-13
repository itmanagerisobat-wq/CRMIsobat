-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table accords_principe add column if not exists date_prochain_rappel date;

-- Statuts AP pour lesquels une date de prochain rappel est obligatoire
-- (modifiable ensuite dans Parametres -> "Statuts AP necessitant une date de rappel")
insert into parametres (key, values) values
  ('statuts_ap_rappel', array['A rappeler'])
on conflict (key) do nothing;
