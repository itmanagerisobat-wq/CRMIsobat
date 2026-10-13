import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KEEP = 14; // keep the last 14 automatic backups

export async function GET(req: NextRequest) {
  // Vercel Cron requests carry this header automatically; if a CRON_SECRET
  // is configured, also accept manual calls that present it (for testing).
  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  const secretOk = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !secretOk) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const [rdvRes, paramsRes] = await Promise.all([
    db.from('rdv').select('*'),
    db.from('parametres').select('*'),
  ]);
  if (rdvRes.error) return NextResponse.json({ error: rdvRes.error.message }, { status: 500 });
  if (paramsRes.error) return NextResponse.json({ error: paramsRes.error.message }, { status: 500 });

  const snapshot = {
    version: 1,
    rdv: rdvRes.data,
    parametres: paramsRes.data,
  };

  const { error: insertError } = await db.from('backups').insert({ data: snapshot });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // prune old backups beyond KEEP
  const { data: all } = await db
    .from('backups')
    .select('id, created_at')
    .order('created_at', { ascending: false });
  if (all && all.length > KEEP) {
    const toDelete = all.slice(KEEP).map((b) => b.id);
    await db.from('backups').delete().in('id', toDelete);
  }

  return NextResponse.json({ ok: true, rdvCount: rdvRes.data?.length ?? 0 });
}
