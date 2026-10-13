import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rdv, parametres, mode } = body as {
    rdv: any[]; parametres: any[]; mode: 'replace' | 'merge';
  };

  if (!Array.isArray(rdv) || !Array.isArray(parametres)) {
    return NextResponse.json({ error: 'Fichier de sauvegarde invalide' }, { status: 400 });
  }

  const db = supabaseAdmin();

  if (mode === 'replace') {
    const del1 = await db.from('rdv').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (del1.error) return NextResponse.json({ error: del1.error.message }, { status: 500 });
  }

  const cleanRdv = rdv.map((r) => {
    const { id, created_at, ...rest } = r;
    return rest;
  });

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < cleanRdv.length; i += CHUNK) {
    const chunk = cleanRdv.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const { error } = await db.from('rdv').insert(chunk);
    if (error) return NextResponse.json({ error: error.message, inserted }, { status: 500 });
    inserted += chunk.length;
  }

  for (const p of parametres) {
    const { error } = await db.from('parametres').upsert({ key: p.key, values: p.values }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message, inserted }, { status: 500 });
  }

  const actor = await getSessionUser(req);
  logActivity(actor, 'restore_backup', `Mode: ${mode} - ${inserted} RDV, ${parametres.length} liste(s)`);

  return NextResponse.json({ ok: true, inserted, parametresRestored: parametres.length });
}
