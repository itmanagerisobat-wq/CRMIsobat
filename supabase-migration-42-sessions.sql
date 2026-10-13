-- Deconnexion a distance : toute session emise avant cette date est refusee.
alter table users add column if not exists sessions_valid_after timestamptz;
