import { supabaseAdmin } from '@/lib/supabase';
import type { SessionUser } from '@/lib/auth';

export async function logActivity(user: SessionUser | null, action: string, details?: string, rdvId?: string) {
  try {
    const db = supabaseAdmin();
    await db.from('activity_log').insert({
      user_display_name: user?.displayName || 'Inconnu',
      user_role: user?.role || null,
      action,
      details: details || null,
      rdv_id: rdvId || null,
    });
  } catch {
    // logging must never break the actual request
  }
}
