-- A executer dans Supabase -> SQL Editor -> New query -> Run

insert into parametres (key, values) values
  ('duree_visite_minutes', array['60'])
on conflict (key) do nothing;
