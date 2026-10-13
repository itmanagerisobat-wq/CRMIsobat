-- A executer une seule fois dans Supabase : Project -> SQL Editor -> New query -> coller -> Run

create extension if not exists "pgcrypto";

create table if not exists rdv (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  week_number int not null,
  date date,
  heure text,
  operation text,
  prestataire text,
  commercial text,
  departement text,
  code_postal text,
  critere text,
  statut text,
  client text,
  motif text,
  created_at timestamptz default now()
);

create index if not exists rdv_month_week_idx on rdv (month, week_number);

create table if not exists parametres (
  key text primary key,
  values text[] not null default '{}'
);

-- Donnees de depart (reprises du fichier Excel) -- modifiable ensuite depuis
-- la page "Parametres" de l'application.
insert into parametres (key, values) values
  ('operations', array['174','171','175','174+171','174+175','vev','destra','Autre']),
  ('commerciaux', array['Amine','Bechir','Samy','Jeremy','Rym','Feriel','B-Tunis','Ramzi']),
  ('prestataires', array['Ramzi','Rym','B-Tunis','Feriel']),
  ('heures', array['08h00','08h30','09h00','09h30','10h00','10h30','11h00','11h30',
                    '14h00','14h30','15h00','15h30','16h00','16h30','17h00','17h30']),
  ('motifs', array['Client absent','Injoignable','Refus du client',
                    'Report a la demande du client','Meteo','Conflit planning interne',
                    'Erreur de saisie','Autre']),
  ('departements', array['02 - Aisne','06 - Alpes-Maritimes','75 - Paris'])
on conflict (key) do nothing;

-- Row Level Security : verrouillee par defaut. L'application n'accede a
-- cette base que via la cle "service_role" (cote serveur uniquement), qui
-- contourne RLS -- donc ces tables ne sont JAMAIS exposees directement au
-- navigateur. Rien d'autre a faire ici.
alter table rdv enable row level security;
alter table parametres enable row level security;
