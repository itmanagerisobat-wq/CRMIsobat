-- A executer dans Supabase -> SQL Editor -> New query -> Run

-- Correction des couleurs importees pour Aout 2026 (meme logique que Juillet)
update rdv set statut = null
where month = 'Aout 2026' and statut = 'Vert';

update rdv set statut = 'Annule'
where month = 'Aout 2026' and statut = 'Rouge';

update rdv set statut = 'Reporte'
where month = 'Aout 2026' and statut in ('Violet', 'Rose', 'Jaune');

update rdv set statut = 'Non confirme'
where month = 'Aout 2026' and statut = 'Orange';

-- Nouveau champ Raison sociale
alter table rdv add column if not exists raison_sociale text;
create index if not exists rdv_raison_sociale_idx on rdv (lower(raison_sociale));
