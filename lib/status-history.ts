import { supabaseAdmin } from './supabase';
import { directDb } from './db-direct';

export interface StatusHistoryRow {
  id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  user_display_name: string | null;
  created_at: string;
}

/** Records a statut change. Never throws -- history must not break the request. */
export async function logStatusChange(e: {
  entity_type: 'rdv' | 'ap' | 'b2c'; entity_id: string; field: string;
  old_value: string | null | undefined; new_value: string | null | undefined;
  comment?: string | null; user?: string | null;
}) {
  if ((e.old_value || '') === (e.new_value || '')) return;
  try {
    if (process.env.DATABASE_URL) {
      await directDb().query(
        `insert into status_history (entity_type, entity_id, field, old_value, new_value, comment, user_display_name)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [e.entity_type, e.entity_id, e.field, e.old_value || null, e.new_value || null, e.comment || null, e.user || null]
      );
    } else {
      await supabaseAdmin().from('status_history').insert({
        entity_type: e.entity_type, entity_id: e.entity_id, field: e.field,
        old_value: e.old_value || null, new_value: e.new_value || null,
        comment: e.comment || null, user_display_name: e.user || null,
      });
    }
  } catch {
    // table missing (migration not run yet) or DB hiccup -- ignore
  }
}

export async function listStatusHistory(entity_type: string, entity_id: string): Promise<StatusHistoryRow[]> {
  if (process.env.DATABASE_URL) {
    const { rows } = await directDb().query(
      'select * from status_history where entity_type = $1 and entity_id = $2 order by created_at desc',
      [entity_type, entity_id]
    );
    return rows;
  }
  const { data, error } = await supabaseAdmin().from('status_history').select('*')
    .eq('entity_type', entity_type).eq('entity_id', entity_id).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}
