-- A executer dans Supabase -> SQL Editor -> New query -> Run

alter table agent_pins add column if not exists univers text not null default 'b2b' check (univers in ('b2b', 'b2c'));
alter table rdv_requests add column if not exists type_client text not null default 'b2b' check (type_client in ('b2b', 'b2c'));

alter table rdv add column if not exists document_statut text;
alter table rdv add column if not exists document_note text;

insert into parametres (key, values) values
  ('documents_statuts', array['Document manquant','En attente de retour client'])
on conflict (key) do nothing;
