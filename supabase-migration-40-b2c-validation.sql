-- A executer dans Supabase -> SQL Editor -> New query -> Run
-- Etape "RDV envoyes par les agents" -> "Confirmation" (valides mais pas encore confirmes)

alter table rdv_requests add column if not exists valide_at timestamptz;

-- RDV B2C deja traites avant cette version : consideres comme valides
update rdv_requests
   set valide_at = coalesce(updated_at, created_at)
 where flow = 'manual' and valide_at is null
   and coalesce(confirmation_statut, 'A confirmer') <> 'A confirmer';

notify pgrst, 'reload schema';
