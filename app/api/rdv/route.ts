import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseMonth } from '@/lib/weeks';
import { buildMonthLabel } from '@/lib/months';
import { weekNumberForDate } from '@/lib/weeks';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const week = searchParams.get('week');
  const date = searchParams.get('date');
  const trash = searchParams.get('trash') === '1';

  const db = supabaseAdmin();
  let query = db.from('rdv').select('*').order('date', { ascending: true });
  // Le mois / la semaine sont deduits de la DATE du RDV (jamais des colonnes stockees, qui peuvent etre en retard
  // apres un report) : un RDV apparait toujours dans la semaine qui contient sa date.
  if (month) {
    const { year, monthNum } = parseMonth(month);
    if (monthNum) {
      const start = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const end = new Date(Date.UTC(year, monthNum, 0)).toISOString().slice(0, 10);
      query = query.or(`and(date.gte.${start},date.lte.${end}),and(date.is.null,month.eq.${month})`);
    } else query = query.eq('month', month);
  }
  if (date) query = query.eq('date', date);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // filtered in JS (not via a chained .is()/.eq() on deleted_at) to stay
  // consistent with how the other list routes work around a flaky filter
  let filtered = (data || []).filter((r) => (trash ? !!r.deleted_at : !r.deleted_at));
  if (month && week) {
    const w = Number(week);
    filtered = filtered.filter((r) => (r.date ? weekNumberForDate(month, String(r.date)) === w : r.week_number === w));
  }
  // Responsable B2C : uniquement les RDV B2C envoyes par les agents
  const actor = await getSessionUser(req);
  if (actor?.role === 'viewer' || actor?.role === 'relanceur') {
    filtered = filtered.filter((r) => (r.type_client || 'b2b') === 'b2b');
  }
  if (actor?.role === 'responsable_b2c') {
    filtered = filtered.filter((r) => r.type_client === 'b2c');
  }

  return NextResponse.json({ data: filtered }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = supabaseAdmin();
  if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.date)) {
    const [yy, mm] = body.date.slice(0, 10).split('-').map((n: string) => parseInt(n, 10));
    body.month = buildMonthLabel(yy, mm);
    body.week_number = weekNumberForDate(body.month, body.date);
  }
  const who = await getSessionUser(req);
  if (who?.role === 'responsable_b2c') body.type_client = 'b2c';
  const { data, error } = await db.from('rdv').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // auto-create a client fiche the first time this raison_sociale is seen
  // (never overwrites an existing fiche -- that one may have been edited by hand)
  if (body.raison_sociale?.trim()) {
    const { data: existing } = await db
      .from('clients')
      .select('id')
      .ilike('raison_sociale', body.raison_sociale.trim())
      .maybeSingle();
    if (!existing) {
      await db.from('clients').insert({
        raison_sociale: body.raison_sociale.trim(),
        responsable: body.client || null,
        fonction_responsable: body.fonction_responsable || null,
        telephone: body.telephone || null,
      });
    }
  }

  const actor = await getSessionUser(req);
  logActivity(actor, 'create_rdv', `${body.commercial || ''} ${body.operation || ''} - ${body.month || ''}`.trim());

  return NextResponse.json({ data });
}
