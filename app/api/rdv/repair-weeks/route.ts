import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { buildMonthLabel } from '@/lib/months';
import { weekNumberForDate } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

// Remet chaque RDV dans le bon mois / la bonne semaine du Planning d'apres sa date (reports et RDV du week-end deja enregistres).
export async function POST(req: NextRequest) {
  const actor = await getSessionUser(req);
  if (!actor || (actor.role !== 'admin' && actor.role !== 'gestionnaire')) {
    return NextResponse.json({ error: 'Acces reserve' }, { status: 403 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db.from('rdv').select('id, date, month, week_number');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let fixed = 0;
  for (const r of data || []) {
    if (!r.date) continue;
    const d = String(r.date).slice(0, 10);
    const [y, m] = d.split('-').map((n) => parseInt(n, 10));
    if (!y || !m) continue;
    const month = buildMonthLabel(y, m);
    const week = weekNumberForDate(month, d);
    if (r.month !== month || r.week_number !== week) {
      const { error: e2 } = await db.from('rdv').update({ month, week_number: week }).eq('id', r.id);
      if (!e2) fixed++;
    }
  }
  return NextResponse.json({ fixed });
}
