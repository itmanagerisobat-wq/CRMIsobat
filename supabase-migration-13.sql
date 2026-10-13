-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table relance_log add column if not exists date_prochain_contact date;
create index if not exists relance_log_next_contact_idx on relance_log (date_prochain_contact);
