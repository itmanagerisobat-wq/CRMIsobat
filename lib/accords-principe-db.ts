// Same rationale as lib/agent-pins-db.ts: bypass Supabase's PostgREST (Data
// API) layer, which has repeatedly served stale data or a stale schema
// cache for this project (see rdv_requests and agent_pins), by talking to
// Postgres directly via DATABASE_URL when it's configured. Falls back to
// the Supabase REST client only if DATABASE_URL isn't set.

import { supabaseAdmin } from './supabase';
import { directDb } from './db-direct';

export interface AccordPrincipeRow {
  id: string;
  raison_sociale: string | null;
  client: string | null;
  telephone: string | null;
  adresse: string | null;
  operation: string | null;
  agent_id: string | null;
  agent_name: string | null;
  statut: string | null;
  commentaire: string | null;
  date_prochain_rappel: string | null;
  rdv_envoye_at: string | null;
  type_client: 'b2b' | 'b2c';
  created_at: string;
  updated_at: string;
}

function useDirect(): boolean {
  return !!process.env.DATABASE_URL;
}

export async function listAccordsPrincipe(filters: { agentId?: string; typeClient?: 'b2b' | 'b2c' }): Promise<AccordPrincipeRow[]> {
  if (useDirect()) {
    const clauses: string[] = [];
    const values: any[] = [];
    if (filters.agentId) { values.push(filters.agentId); clauses.push(`agent_id = $${values.length}`); }
    if (filters.typeClient) { values.push(filters.typeClient); clauses.push(`type_client = $${values.length}`); }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const { rows } = await directDb().query(`select * from accords_principe ${where} order by created_at desc`, values);
    return rows;
  }
  const db = supabaseAdmin();
  let query = db.from('accords_principe').select('*').order('created_at', { ascending: false });
  if (filters.agentId) query = query.eq('agent_id', filters.agentId);
  if (filters.typeClient) query = query.eq('type_client', filters.typeClient);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getAccordPrincipeById(id: string): Promise<AccordPrincipeRow | null> {
  if (useDirect()) {
    const { rows } = await directDb().query('select * from accords_principe where id = $1', [id]);
    return rows[0] || null;
  }
  const db = supabaseAdmin();
  const { data } = await db.from('accords_principe').select('*').eq('id', id).maybeSingle();
  return data || null;
}

export async function insertAccordPrincipe(fields: {
  raison_sociale: string | null; client: string | null; telephone: string | null; adresse: string | null;
  operation: string | null; agent_id: string | null; agent_name: string | null; statut: string | null;
  commentaire: string | null; date_prochain_rappel: string | null; type_client: 'b2b' | 'b2c';
}): Promise<AccordPrincipeRow> {
  if (useDirect()) {
    const { rows } = await directDb().query(
      `insert into accords_principe
        (raison_sociale, client, telephone, adresse, operation, agent_id, agent_name, statut, commentaire, date_prochain_rappel, type_client)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning *`,
      [fields.raison_sociale, fields.client, fields.telephone, fields.adresse, fields.operation, fields.agent_id,
       fields.agent_name, fields.statut, fields.commentaire, fields.date_prochain_rappel, fields.type_client]
    );
    return rows[0];
  }
  const db = supabaseAdmin();
  const { data, error } = await db.from('accords_principe').insert(fields).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAccordPrincipe(id: string, patch: Record<string, any>): Promise<AccordPrincipeRow> {
  if (useDirect()) {
    const keys = Object.keys(patch);
    if (keys.length === 0) {
      const existing = await getAccordPrincipeById(id);
      if (!existing) throw new Error('Introuvable');
      return existing;
    }
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map((k) => patch[k]);
    values.push(id);
    const { rows } = await directDb().query(
      `update accords_principe set ${setClauses.join(', ')} where id = $${values.length} returning *`,
      values
    );
    if (!rows[0]) throw new Error('Accord de principe introuvable');
    return rows[0];
  }
  const db = supabaseAdmin();
  const { data, error } = await db.from('accords_principe').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAccordPrincipe(id: string): Promise<void> {
  if (useDirect()) {
    await directDb().query('delete from accords_principe where id = $1', [id]);
    return;
  }
  const db = supabaseAdmin();
  const { error } = await db.from('accords_principe').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getParametreValues(key: string): Promise<string[]> {
  if (useDirect()) {
    const { rows } = await directDb().query('select values from parametres where key = $1', [key]);
    return rows[0]?.values || [];
  }
  const db = supabaseAdmin();
  const { data } = await db.from('parametres').select('*').eq('key', key).maybeSingle();
  return data?.values || [];
}
