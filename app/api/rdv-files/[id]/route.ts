import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { rows } = await directDb().query('select filename, mime, data from rdv_files where id = $1', [params.id]);
    if (!rows[0]) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
    const f = rows[0];
    return new NextResponse(f.data, {
      headers: {
        'Content-Type': f.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await directDb().query('delete from rdv_files where id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
