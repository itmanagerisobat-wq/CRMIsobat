-- A executer UNE SEULE FOIS dans Supabase -> SQL Editor -> New query -> Run
-- Corrige les statuts "couleur" importes pour Juillet 2026 uniquement.

update rdv set statut = null
where month = 'Juillet 2026' and statut = 'Vert';

update rdv set statut = 'Annule'
where month = 'Juillet 2026' and statut = 'Rouge';

update rdv set statut = 'Reporte'
where month = 'Juillet 2026' and statut in ('Violet', 'Rose', 'Jaune');

update rdv set statut = 'Non confirme'
where month = 'Juillet 2026' and statut = 'Orange';
