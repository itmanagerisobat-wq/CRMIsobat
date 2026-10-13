-- A executer dans Supabase -> SQL Editor -> New query -> Run

insert into parametres (key, values) values
  ('max_rdv_par_jour', array['3'])
on conflict (key) do nothing;
