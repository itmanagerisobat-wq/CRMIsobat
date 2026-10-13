import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Synchronisation automatique : toute raison sociale (B2B) ou tout client (B2C) present dans les RDV
// et absent du carnet y est ajoute. Ne modifie jamais une fiche existante.
async function syncFromRdv(db: ReturnType<typeof supabaseAdmin>) {
  const [{ data: rdvs }, { data: clients }] = await Promise.all([
    db.from('rdv').select('raison_sociale, client, telephone, adresse, type_client, deleted_at').is('deleted_at', null),
    db.from('clients').select('type, raison_sociale, nom, prenom'),
  ]);
  const norm = (v: string | null | undefined) => (v || '').trim().toLowerCase();
  const haveB2b = new Set((clients || []).filter((c: any) => c.type !== 'b2c').map((c: any) => norm(c.raison_sociale)));
  const haveB2c = new Set((clients || []).filter((c: any) => c.type === 'b2c').map((c: any) => norm(`${c.prenom || ''} ${c.nom || ''}`)));
  const toInsert: any[] = [];
  for (const r of rdvs || []) {
    if ((r.type_client || 'b2b') === 'b2c') {
      const full = (r.client || r.raison_sociale || '').trim();
      if (!full || haveB2c.has(norm(full))) continue;
      haveB2c.add(norm(full));
      const parts = full.split(/\s+/);
      const nom = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
      const prenom = parts.length > 1 ? parts[0] : null;
      toInsert.push({ type: 'b2c', nom, prenom, telephone: r.telephone || null, adresse: r.adresse || null });
    } else {
      const rs = (r.raison_sociale || '').trim();
      if (!rs || haveB2b.has(norm(rs))) continue;
      haveB2b.add(norm(rs));
      toInsert.push({ type: 'b2b', raison_sociale: rs, responsable: r.client || null, telephone: r.telephone || null, adresse: r.adresse || null });
    }
  }
  if (toInsert.length === 0) return;
  const { error } = await db.from('clients').insert(toInsert);
  if (error) {
    for (const row of toInsert) await db.from('clients').insert(row); // une ligne en doublon ne bloque pas les autres
  }
}

export async function GET() {
  const db = supabaseAdmin();
  try { await syncFromRdv(db); } catch { /* la liste reste affichee meme si la synchro echoue */ }
  const { data, error } = await db.from('clients').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const type = body.type === 'b2c' ? 'b2c' : 'b2b';
  if (type === 'b2b' && !body.raison_sociale?.trim()) {
    return NextResponse.json({ error: 'Raison sociale requise' }, { status: 400 });
  }
  if (type === 'b2c' && !body.nom?.trim()) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('clients')
    .insert({
      type,
      raison_sociale: type === 'b2b' ? (body.raison_sociale || '').trim() : null,
      nom: type === 'b2c' ? (body.nom || '').trim() : null,
      prenom: type === 'b2c' ? (body.prenom || '').trim() || null : null,
      adresse: body.adresse || null,
      responsable: body.responsable || null,
      fonction_responsable: body.fonction_responsable || null,
      telephone: body.telephone || null,
      site_info: body.site_info || {},
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
