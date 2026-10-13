-- A executer dans Supabase -> SQL Editor -> New query -> Run

insert into parametres (key, values) values
  ('stats_affichees', array['non honore','honore','Reporte','Annule'])
on conflict (key) do nothing;
