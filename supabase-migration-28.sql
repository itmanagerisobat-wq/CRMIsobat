-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table rdv add column if not exists nombre_reports int not null default 0;
