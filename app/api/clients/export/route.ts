import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const withVisits = req.nextUrl.searchParams.get('avec_visite') === '1';
  const db = supabaseAdmin();
  const { data: clients, error } = await db.from('clients').select('*').order('raison_sociale');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Clients');

  const headers = withVisits
    ? ['Raison sociale', 'Adresse', 'Responsable', 'Telephone', 'Dernier statut', 'Sous-statut', 'Derniere visite', 'Nb RDV']
    : ['Raison sociale', 'Adresse', 'Responsable', 'Telephone'];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8A3E' } };
  });

  for (const c of clients || []) {
    if (!withVisits) {
      ws.addRow([c.raison_sociale, c.adresse, c.responsable, c.telephone]);
      continue;
    }
    const { data: rdvs } = await db
      .from('rdv')
      .select('*')
      .ilike('raison_sociale', c.raison_sociale)
      .order('date', { ascending: false })
      .limit(1);
    const { count } = await db
      .from('rdv')
      .select('*', { count: 'exact', head: true })
      .ilike('raison_sociale', c.raison_sociale);
    const last = rdvs?.[0];
    ws.addRow([
      c.raison_sociale, c.adresse, c.responsable, c.telephone,
      last?.statut || 'Confirme', last?.sous_statut || '', last?.date || '', count || 0,
    ]);
  }

  ws.columns.forEach((col, i) => { col.width = [24, 30, 20, 16, 16, 20, 14, 8][i] || 16; });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Clients${withVisits ? '_avec_visites' : ''}.xlsx"`,
    },
  });
}
