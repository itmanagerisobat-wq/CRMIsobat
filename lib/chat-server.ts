import { directDb } from './db-direct';
import type { SessionUser } from './auth';
import type { ChatScope } from './chat';

export async function scopeOf(me: SessionUser): Promise<ChatScope> {
  if (me.role === 'admin' || me.role === 'gestionnaire') return 'all';
  if (me.role === 'responsable_b2c') return 'b2c';
  if (me.role === 'agent' && me.userId.startsWith('agentpin-')) {
    try {
      const { rows } = await directDb().query('select univers from agent_pins where id = $1', [me.userId.replace('agentpin-', '')]);
      return rows[0]?.univers === 'b2c' ? 'b2c' : 'b2b';
    } catch { return 'b2b'; }
  }
  return 'b2b';
}
