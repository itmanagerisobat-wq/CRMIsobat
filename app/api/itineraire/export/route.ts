import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { routeBetweenPostalCodes } from '@/lib/distance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'Mois requis' }, { status: 400 });

  const db = supabaseAdmin();
  const [rdvRes, paramsRes, baseRes] = await Promise.all([
    db.from('rdv').select('*').eq('month', month).not('date', 'is', null),
    db.from('parametres').select('*').eq('key', 'commerciaux'),
    db.from('commercial_base').select('*'),
  ]);
  if (rdvRes.error) return NextResponse.json({ error: rdvRes.error.message }, { status: 500 });

  const commerciaux: string[] = paramsRes.data?.[0]?.values || [];
  const basesByCommercial: Record<string, string> = {};
  for (const b of baseRes.data || []) basesByCommercial[b.commercial] = b.code_postal;

  const rows = rdvRes.data || [];
  const byCommercialDay = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.commercial || !r.date) continue;
    const key = `${r.commercial}|${r.date.slice(0, 10)}`;
    const arr = byCommercialDay.get(key) || [];
    arr.push(r);
    byCommercialDay.set(key, arr);
  }

  const wb = new ExcelJS.Workbook();

  const byCommercial = new Map<string, Map<string, typeof rows>>();
  for (const [key, dayRows] of byCommercialDay) {
    const [commercial] = key.split('|');
    if (!byCommercial.has(commercial)) byCommercial.set(commercial, new Map());
    byCommercial.get(commercial)!.set(key, dayRows);
  }

  const commerciauxToExport = commerciaux.filter((c) => byCommercial.has(c));
  if (commerciauxToExport.length === 0) {
    // no assigned RDVs at all this month -- still produce a valid (empty) workbook
    wb.addWorksheet('Itineraire');
  }

  for (const commercial of commerciauxToExport) {
    const sheetName = commercial.slice(0, 31).replace(/[\\/*?:[\]]/g, '');
    const ws = wb.addWorksheet(sheetName || 'Commercial');
    const headerRow = ws.addRow(['Date', 'Arret', 'Heure', 'Client', 'Code Postal', 'Km parcourus (trajet)', 'Statut final']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8A3E' } };
    });

    const commercialDays = byCommercial.get(commercial)!;
    for (const [key, dayRows] of commercialDays) {
      const [, date] = key.split('|');
      const sorted = [...dayRows].sort((a, b) => {
        const pa = parseInt((a.code_postal || '99999').replace(/\D/g, ''), 10) || 99999;
        const pb = parseInt((b.code_postal || '99999').replace(/\D/g, ''), 10) || 99999;
        return pa - pb;
      });
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        let km: number | string = '—';
        if (r.code_postal) {
          const cp1 = i === 0 ? basesByCommercial[commercial] : sorted[i - 1].code_postal;
          if (cp1) {
            const result = await routeBetweenPostalCodes(cp1, r.code_postal);
            if (result) km = result.km;
          }
        }
        const statutFinal = r.sous_statut || r.statut || 'Confirme';
        ws.addRow([date, i + 1, r.heure || '—', r.client || r.raison_sociale || '—', r.code_postal || '—', km, statutFinal]);
      }
    }
    ws.columns.forEach((col, i) => { col.width = [12, 8, 10, 24, 12, 20, 18][i] || 14; });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Itineraire_${month.replace(/\s/g, '_')}.xlsx"`,
    },
  });
}
