-- A executer dans Supabase -> SQL Editor -> New query -> Run

insert into parametres (key, values) values
  ('relanceurs', array[]::text[]),
  ('criteres_carte', array['Total RDV','Honore','Non honore','Non confirme','Annule','Reporte',
                            'Devis signe','KO','En cours de verification','Devis envoye'])
on conflict (key) do nothing;
