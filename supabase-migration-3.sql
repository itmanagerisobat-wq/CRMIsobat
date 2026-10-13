-- A executer dans Supabase -> SQL Editor -> New query -> Run

insert into parametres (key, values) values
  ('relance', array['Reporte','non honore'])
on conflict (key) do nothing;
