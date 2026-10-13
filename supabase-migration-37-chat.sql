-- A executer dans Supabase -> SQL Editor -> New query -> Run

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,            -- 'general' ou 'dm:<idA>|<idB>' (ids tries)
  sender_id text not null,
  sender_name text not null,
  sender_role text,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists chat_messages_channel_idx on chat_messages (channel, created_at desc);
alter table chat_messages enable row level security;

create table if not exists chat_presence (
  user_id text primary key,
  name text not null,
  role text,
  first_seen timestamptz default now(),
  last_seen timestamptz default now()
);
alter table chat_presence enable row level security;

create table if not exists chat_reads (
  user_id text not null,
  channel text not null,
  last_read_at timestamptz default now(),
  primary key (user_id, channel)
);
alter table chat_reads enable row level security;

notify pgrst, 'reload schema';
