import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const HEADERS = ['Mois', 'Semaine', 'Date', 'Heure', 'Operation', 'Prestataire', 'Commercial', 'Statut', 'Sous-statut', 'Responsable', 'Raison sociale', 'Telephone', 'Motif'];

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month');

  const db = supabaseAdmin();
  const { data: paramsData } = await db.from('parametres').select('*').eq('key', 'relance').single();
  const relanceList: string[] = paramsData?.values || [];

  if (relanceList.length === 0) {
    return NextResponse.json({ error: 'Aucun statut configure pour la relance' }, { status: 400 });
  }

  let query = db.from('rdv').select('*').in('statut', relanceList);
  if (month) query = query.eq('month', month);
  const { data, error } = await query.order('month').order('week_number');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Relance');

  ws.mergeCells('A1:M1');
  const title = ws.getCell('A1');
  title.value = `RELANCE${month ? ' - ' + month.toUpperCase() : ''}`;
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8A3E' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9A227' } };
    cell.alignment = { horizontal: 'center' };
  });

  for (const r of data ?? []) {
    ws.addRow([
      r.month, r.week_number, r.date, r.heure, r.operation, r.prestataire,
      r.commercial, r.statut, r.sous_statut, r.client, r.raison_sociale, r.telephone, r.motif,
    ]);
  }

  ws.columns.forEach((col, i) => {
    col.width = [16, 10, 12, 10, 12, 16, 14, 16, 20, 18, 20, 16, 22][i] || 14;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Relance${month ? '_' + month.replace(/ /g, '_') : ''}.xlsx"`,
    },
  });
}
