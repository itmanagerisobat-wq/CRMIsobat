import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('backups').select('*').eq('id', params.id).single();
  if (error || !data) return NextResponse.json({ error: 'Sauvegarde introuvable' }, { status: 404 });

  const json = JSON.stringify(data.data, null, 2);
  const filename = `isobat-planning-auto-${data.created_at.slice(0, 10)}.json`;
  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // restore this specific automatic backup (always full replace)
  const db = supabaseAdmin();
  const { data: backup, error } = await db.from('backups').select('*').eq('id', params.id).single();
  if (error || !backup) return NextResponse.json({ error: 'Sauvegarde introuvable' }, { status: 404 });

  const { rdv, parametres } = backup.data as { rdv: any[]; parametres: any[] };

  const del1 = await db.from('rdv').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (del1.error) return NextResponse.json({ error: del1.error.message }, { status: 500 });

  const cleanRdv = (rdv || []).map((r: any) => {
    const { id, created_at, ...rest } = r;
    return rest;
  });

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < cleanRdv.length; i += CHUNK) {
    const chunk = cleanRdv.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const { error: insErr } = await db.from('rdv').insert(chunk);
    if (insErr) return NextResponse.json({ error: insErr.message, inserted }, { status: 500 });
    inserted += chunk.length;
  }

  for (const p of parametres || []) {
    await db.from('parametres').upsert({ key: p.key, values: p.values }, { onConflict: 'key' });
  }

  const actor = await getSessionUser(req);
  logActivity(actor, 'restore_backup', `Sauvegarde automatique du ${backup.created_at.slice(0, 10)} restauree (${inserted} RDV)`);

  return NextResponse.json({ ok: true, inserted });
}
