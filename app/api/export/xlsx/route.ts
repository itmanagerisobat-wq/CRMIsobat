import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'Semaine', 'Date', 'Heure', 'Operation', 'Prestataire', 'Commercial',
  'Departement', 'Code Postal', 'Critere', 'Statut', 'Sous-statut', 'Responsable', 'Raison sociale', 'Telephone', 'Motif',
];

const STATUT_COLORS: Record<string, string> = {
  'non honore': 'FF2196F3',
  honore: 'FF00B050',
  Reporte: 'FF8B2FE0',
  Annule: 'FFE4032E',
};

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month is required' }, { status: 400 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('rdv')
    .select('*')
    .eq('month', month)
    .order('week_number', { ascending: true })
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(month.slice(0, 31));

  ws.mergeCells('A1:O1');
  const title = ws.getCell('A1');
  title.value = `PLANNING ${month.toUpperCase()}`;
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8A3E' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8DC63F' } };
    cell.alignment = { horizontal: 'center' };
  });

  for (const r of data ?? []) {
    const row = ws.addRow([
      r.week_number, r.date, r.heure, r.operation, r.prestataire, r.commercial,
      r.departement, r.code_postal, r.critere, r.statut, r.sous_statut, r.client, r.raison_sociale, r.telephone, r.motif,
    ]);
    const statutCell = row.getCell(10);
    const color = STATUT_COLORS[r.statut as string];
    if (color) {
      statutCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      statutCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
  }

  ws.columns.forEach((col, i) => {
    col.width = [10, 12, 10, 12, 16, 14, 18, 12, 20, 14, 20, 18, 20, 16, 22][i] || 14;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Planning_${month.replace(/ /g, '_')}.xlsx"`,
    },
  });
}
