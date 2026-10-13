import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = supabaseAdmin();
  const [rdvRes, paramsRes] = await Promise.all([
    db.from('rdv').select('*'),
    db.from('parametres').select('*'),
  ]);

  if (rdvRes.error) return NextResponse.json({ error: rdvRes.error.message }, { status: 500 });
  if (paramsRes.error) return NextResponse.json({ error: paramsRes.error.message }, { status: 500 });

  const backup = {
    version: 1,
    created_at: new Date().toISOString(),
    rdv: rdvRes.data,
    parametres: paramsRes.data,
  };

  const json = JSON.stringify(backup, null, 2);
  const filename = `isobat-planning-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
