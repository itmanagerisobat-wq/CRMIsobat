-- A executer dans Supabase -> SQL Editor -> New query -> Run
-- Ajoute "Devis envoye" a la liste des sous-statuts si elle n'y est pas deja

update parametres
set values = array_append(values, 'Devis envoye')
where key = 'sous_statuts'
  and not ('Devis envoye' = any(values));
