// Same rationale as lib/db-direct.ts / app/api/rdv-requests/route.ts: Supabase's
// PostgREST (Data API) layer has been observed serving stale reads for this
// project. agent_pins is read on every single login attempt (team members
// picking their name + typing a PIN), so any staleness there directly causes
// "Mot de passe, nom ou code PIN incorrect" errors even with a correct PIN --
// the code reads an outdated pin_hash (or a not-yet-visible new agent row).
// To fix this "once and for all", every agent_pins read/write goes through
// the direct Postgres connection when DATABASE_URL is configured, bypassing
// PostgREST entirely. Falls back to the Supabase REST client only if
// DATABASE_URL isn't set (e.g. a dev environment without it configured).

import { supabaseAdmin } from './supabase';
import { directDb } from './db-direct';

export interface AgentPinRow {
  id: string;
  name: string;
  pin_hash: string | null;
  created_at?: string;
  univers?: string;
  username?: string | null;
}

function useDirect(): boolean {
  return !!process.env.DATABASE_URL;
}

export async function listAgentPins(): Promise<AgentPinRow[]> {
  if (useDirect()) {
    const { rows } = await directDb().query('select id, name, pin_hash, created_at, univers, username from agent_pins order by name');
    return rows;
  }
  const db = supabaseAdmin();
  const { data, error } = await db.from('agent_pins').select('id, name, pin_hash, created_at, univers, username').order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getAgentPinById(id: string): Promise<AgentPinRow | null> {
  if (useDirect()) {
    const { rows } = await directDb().query('select * from agent_pins where id = $1', [id]);
    return rows[0] || null;
  }
  const db = supabaseAdmin();
  const { data } = await db.from('agent_pins').select('*').eq('id', id).maybeSingle();
  return data || null;
}

export async function setAgentPinHash(id: string, pin_hash: string | null): Promise<void> {
  if (useDirect()) {
    await directDb().query('update agent_pins set pin_hash = $1 where id = $2', [pin_hash, id]);
    return;
  }
  const db = supabaseAdmin();
  const { error } = await db.from('agent_pins').update({ pin_hash }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function insertAgentPin(name: string, univers: string = 'b2b'): Promise<{ id: string; name: string; created_at: string }> {
  if (useDirect()) {
    const { rows } = await directDb().query(
      'insert into agent_pins (name, pin_hash, univers) values ($1, null, $2) returning id, name, created_at',
      [name, univers]
    );
    return rows[0];
  }
  const db = supabaseAdmin();
  const { data, error } = await db.from('agent_pins').insert({ name, pin_hash: null, univers }).select('id, name, created_at').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAgentPin(id: string): Promise<void> {
  if (useDirect()) {
    await directDb().query('delete from agent_pins where id = $1', [id]);
    return;
  }
  const db = supabaseAdmin();
  const { error } = await db.from('agent_pins').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setAgentUnivers(id: string, univers: string): Promise<void> {
  if (useDirect()) {
    await directDb().query('update agent_pins set univers = $1 where id = $2', [univers, id]);
    return;
  }
  const db = supabaseAdmin();
  const { error } = await db.from('agent_pins').update({ univers }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getAgentByUsername(username: string): Promise<AgentPinRow | null> {
  const { rows } = await directDb().query('select * from agent_pins where lower(username) = lower($1)', [username.trim()]);
  return rows[0] || null;
}

export async function setAgentCredentials(id: string, username: string | null, hash: string | null): Promise<void> {
  await directDb().query('update agent_pins set username = coalesce($1, username), pin_hash = coalesce($2, pin_hash) where id = $3', [username, hash, id]);
}

export async function renameAgent(id: string, name: string, username: string): Promise<void> {
  await directDb().query('update agent_pins set name = $1, username = $2 where id = $3', [name, username, id]);
}

export async function revokeAgentSessions(id: string): Promise<void> {
  await directDb().query('update agent_pins set sessions_valid_after = now() where id = $1', [id]);
}

export async function revokeAllAgentSessions(): Promise<void> {
  await directDb().query('update agent_pins set sessions_valid_after = now()');
}

export async function usernameTaken(username: string, exceptId?: string): Promise<boolean> {
  const { rows } = await directDb().query('select id from agent_pins where lower(username) = lower($1) and ($2::uuid is null or id <> $2::uuid)', [username, exceptId || null]);
  if (rows.length) return true;
  const u = await directDb().query('select id from users where lower(username) = lower($1)', [username]);
  return u.rows.length > 0;
}
