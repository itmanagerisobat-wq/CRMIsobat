import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { listAccordsPrincipe } from '@/lib/accords-principe-db';

export const dynamic = 'force-dynamic';

const HEADERS = ['Raison sociale', 'Responsable', 'Telephone', 'Adresse', 'Operation', 'Agent', 'Statut', 'Prochain rappel', 'Commentaire', 'Cree le'];

export async function GET(req: NextRequest) {
  const univers = req.nextUrl.searchParams.get('univers');

  let data;
  try {
    data = await listAccordsPrincipe(univers === 'b2b' || univers === 'b2c' ? { typeClient: univers } : {});
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Accords de principe');

  ws.mergeCells('A1:J1');
  const title = ws.getCell('A1');
  title.value = 'ACCORDS DE PRINCIPE';
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
      r.raison_sociale, r.client, r.telephone, r.adresse, r.operation, r.agent_name,
      r.statut, r.date_prochain_rappel, r.commentaire,
      r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '',
    ]);
  }

  ws.columns.forEach((col, i) => {
    col.width = [20, 18, 16, 24, 16, 16, 16, 16, 30, 14][i] || 14;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Accords_de_principe.xlsx"`,
    },
  });
}
