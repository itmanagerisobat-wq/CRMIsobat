-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table accords_principe add column if not exists rdv_envoye_at timestamptz;

-- Force PostgREST to pick up the schema changes from this migration and the
-- previous ones immediately, instead of waiting for its own cache to expire
-- (this is what caused "Could not find the 'date_prochain_rappel' column of
-- 'accords_principe' in the schema cache" after migration 34).
notify pgrst, 'reload schema';
