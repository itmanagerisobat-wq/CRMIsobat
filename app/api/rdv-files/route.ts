import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless request limit is ~4.5 MB

// GET : liste des pieces jointes (sans le contenu). ?rdv_id=... pour un seul RDV.
export async function GET(req: NextRequest) {
  const rdvId = req.nextUrl.searchParams.get('rdv_id');
  try {
    const { rows } = rdvId
      ? await directDb().query('select id, rdv_id, kind, filename, mime, size, created_at from rdv_files where rdv_id = $1 order by created_at desc', [rdvId])
      : await directDb().query('select id, rdv_id, kind, filename, mime, size, created_at from rdv_files order by created_at desc');
    return NextResponse.json({ data: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 200 });
  }
}

// POST multipart : rdv_id, kind ('devis'|'ndd'), file. Remplace l'ancien fichier du meme type.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const rdvId = String(form.get('rdv_id') || '');
    const kind = String(form.get('kind') || '');
    const file = form.get('file') as File | null;
    if (!rdvId || !file || (kind !== 'devis' && kind !== 'ndd' && kind !== 'papiers')) {
      return NextResponse.json({ error: 'rdv_id, kind (devis|ndd|papiers) et file requis' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Fichier trop lourd (${(file.size / 1048576).toFixed(1)} Mo) -- maximum 4 Mo.` }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const actor = await getSessionUser(req);
    const db = directDb();
    // devis / NDD : un seul fichier de chaque type (remplace l'ancien) ; papiers : plusieurs fichiers
    if (kind !== 'papiers') await db.query('delete from rdv_files where rdv_id = $1 and kind = $2', [rdvId, kind]);
    const { rows } = await db.query(
      `insert into rdv_files (rdv_id, kind, filename, mime, size, data, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning id, rdv_id, kind, filename, mime, size, created_at`,
      [rdvId, kind, file.name, file.type || 'application/octet-stream', buf.length, buf, actor?.displayName || null]
    );
    return NextResponse.json({ data: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: `Envoi du fichier impossible : ${e.message}` }, { status: 500 });
  }
}
