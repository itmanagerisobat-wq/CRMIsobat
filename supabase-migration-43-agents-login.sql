-- Agents de prospection : identifiant (ex. hajer@isobat.crm) + mot de passe personnel (plus de PIN).
-- Le mot de passe est stocke dans la colonne existante pin_hash (meme hachage PBKDF2).
alter table agent_pins add column if not exists username text;
alter table agent_pins add column if not exists sessions_valid_after timestamptz;
create unique index if not exists agent_pins_username_uniq on agent_pins (lower(username));
