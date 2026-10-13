import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COLS = [
  { key: 'week_number', label: 'S', width: 20 },
  { key: 'date', label: 'Date', width: 55 },
  { key: 'heure', label: 'Heure', width: 40 },
  { key: 'operation', label: 'Operation', width: 55 },
  { key: 'commercial', label: 'Commercial', width: 60 },
  { key: 'statut', label: 'Statut', width: 55 },
  { key: 'sous_statut', label: 'Sous-statut', width: 70 },
  { key: 'client', label: 'Responsable', width: 60 },
  { key: 'raison_sociale', label: 'Raison sociale', width: 70 },
];

const STATUT_COLORS: Record<string, string> = {
  'non honore': '#2196F3',
  honore: '#00B050',
  Reporte: '#8B2FE0',
  Annule: '#E4032E',
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

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  doc.on('data', (c) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.rect(0, 0, doc.page.width, 40).fill('#0E8A3E');
  doc.fillColor('white').fontSize(16).text(`PLANNING ${month.toUpperCase()}`, 30, 12);

  let y = 60;
  const startX = 30;
  doc.fontSize(9);

  function drawHeader() {
    let x = startX;
    doc.rect(startX, y, COLS.reduce((s, c) => s + c.width, 0), 18).fill('#8DC63F');
    doc.fillColor('white').font('Helvetica-Bold');
    for (const c of COLS) {
      doc.text(c.label, x + 3, y + 5, { width: c.width - 6 });
      x += c.width;
    }
    y += 18;
    doc.font('Helvetica').fillColor('black');
  }

  drawHeader();

  for (const r of data ?? []) {
    if (y > doc.page.height - 40) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
      y = 30;
      drawHeader();
    }
    let x = startX;
    const rowH = 16;
    for (const c of COLS) {
      const raw = (r as any)[c.key];
      let text = raw == null ? '' : String(raw);
      if (c.key === 'date' && raw) text = new Date(raw).toLocaleDateString('fr-FR');
      if (c.key === 'statut' && raw) {
        doc.rect(x, y, c.width - 2, rowH - 2).fill(STATUT_COLORS[raw] || '#eee');
        doc.fillColor('white').text(text, x + 3, y + 3, { width: c.width - 6 });
        doc.fillColor('black');
      } else {
        doc.text(text, x + 3, y + 3, { width: c.width - 6 });
      }
      x += c.width;
    }
    doc.moveTo(startX, y + rowH).lineTo(startX + COLS.reduce((s, c) => s + c.width, 0), y + rowH)
      .strokeColor('#eee').stroke();
    y += rowH;
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Planning_${month.replace(/ /g, '_')}.pdf"`,
    },
  });
}
