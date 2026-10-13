import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { colorNameFor, normalizeMonthName } from '@/lib/import-colors';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BLOCK_WIDTH = 7; // Operation, Prestataire, CodePostal, Heure, Commercial, Critere + 1 spacer
const MAX_ROW_SCAN = 500;
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

function cellText(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === 'object' && 'text' in (v as any)) return String((v as any).text).trim() || null;
  if (v instanceof Date) return v.toLocaleDateString('fr-FR');
  const s = String(v).trim();
  return s === '' ? null : s;
}

function fillArgb(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill as any;
  if (fill && fill.type === 'pattern' && fill.fgColor) return fill.fgColor.argb;
  return undefined;
}

function padPostal(v: string | null): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, '');
  if (!digits) return v;
  return digits.padStart(5, '0');
}

/** The source file's "commercial" cell often contains a whole sentence/note
 * instead of just a name. Extract the known commercial name found inside
 * that text (case-insensitive). If no known name matches, fall back to a
 * heuristic: strip common French connector words from these handwritten
 * notes (reporter, pour, le, env, a...) and if exactly one word remains
 * that looks like a real name (letters only, not a date/number), keep it
 * as-is -- it's likely a commercial not yet added to Parametres. */
const CONNECTOR_WORDS = new Set([
  'reporter', 'reporte', 'pour', 'le', 'la', 'les', 'env', 'envoye', 'envoyer',
  'a', 'à', 'de', 'du', 'des', 'au', 'aux', 'sur', 'avec', 'et', 'ou', 'demande',
  'client', 'rdv', 'relance', 'appel', 'appeler', 'rappel', 'rappeler',
]);

function extractCommercial(raw: string | null, knownNames: string[]): string {
  if (!raw) return 'N/A';
  const lower = raw.toLowerCase();
  for (const name of knownNames) {
    if (name && lower.includes(name.toLowerCase())) return name;
  }

  // fallback heuristic
  const words = raw
    .split(/[\s\/\-,.:]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !CONNECTOR_WORDS.has(w.toLowerCase()) && !/\d/.test(w));

  if (words.length === 1 && /^[a-zA-ZÀ-ÿ]+$/.test(words[0])) {
    return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  }

  return 'N/A';
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Aucun fichier recu' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  // known commercial names, straight from Parametres -- used to extract just
  // the name out of free-text cells in the source file.
  const db = supabaseAdmin();
  const { data: paramRow } = await db.from('parametres').select('values').eq('key', 'commerciaux').single();
  const knownCommerciaux: string[] = paramRow?.values || [];

  const { data: colorMapRow } = await db.from('parametres').select('values').eq('key', 'correspondance_couleurs_import').single();
  const colorToStatut: Record<string, string> = {};
  for (const entry of colorMapRow?.values || []) {
    const [couleur, statut] = entry.split('=');
    if (couleur && statut) colorToStatut[couleur] = statut;
  }

  const rows: any[] = [];
  const summary: Record<string, { total: number; parWeek: Record<number, number>; parCouleur: Record<string, number> }> = {};
  const skippedSheets: string[] = [];
  let feriesSkipped = 0;

  for (const ws of wb.worksheets) {
    const month = normalizeMonthName(ws.name);
    if (!month) {
      skippedSheets.push(ws.name);
      continue;
    }

    // "SEMAINE ..." headers can sit on different rows depending on the sheet
    // (some files have a month title row above them) -- scan the first few
    // rows, and de-duplicate merged cells (exceljs reports the same value on
    // every column spanned by a merge).
    const blocks: { row: number; startCol: number; label: string }[] = [];
    for (let hr = 1; hr <= 5; hr++) {
      const row = ws.getRow(hr);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const master = (cell as any).master;
        if (master && master.address !== cell.address) return; // skip merge duplicates
        const t = cellText(cell);
        if (t && t.toUpperCase().startsWith('SEMAINE')) {
          blocks.push({ row: hr, startCol: colNumber - 1, label: t });
        }
      });
    }
    blocks.sort((a, b) => a.startCol - b.startCol);

    summary[month] = { total: 0, parWeek: {}, parCouleur: {} };

    blocks.forEach((block, blockIdx) => {
      const weekNumber = blockIdx + 1;
      const dataStart = block.row + 2;
      for (let r = dataStart; r <= dataStart + MAX_ROW_SCAN; r++) {
        const opCell = ws.getCell(r, block.startCol);
        const prCell = ws.getCell(r, block.startCol + 1);
        const cpCell = ws.getCell(r, block.startCol + 2);
        const hrCell = ws.getCell(r, block.startCol + 3);
        const coCell = ws.getCell(r, block.startCol + 4);
        const crCell = ws.getCell(r, block.startCol + 5);

        // stray leftover date values sometimes appear in these fields in the
        // source file (copy/paste artefacts) -- they're never legitimate
        // Prestataire / Code Postal / Heure values, so treat as noise.
        // They show up either as real Date objects or as "dd/mm/yyyy" text.
        const looksLikeDate = (c: ExcelJS.Cell) =>
          c.value instanceof Date || (typeof c.value === 'string' && DATE_RE.test(c.value.trim()));
        if (looksLikeDate(prCell) || looksLikeDate(cpCell) || looksLikeDate(hrCell)) {
          continue;
        }

        const operation = cellText(opCell);
        const prestataire = cellText(prCell);
        const codePostal = padPostal(cellText(cpCell));
        const heure = cellText(hrCell);
        const commercialRaw = cellText(coCell);
        const commercial = extractCommercial(commercialRaw, knownCommerciaux);
        const critere = cellText(crCell);

        if (!operation && !prestataire && !heure && !commercialRaw) continue; // blank row

        const lowerCheck = [prestataire, codePostal, heure].map((v) => (v || '').toLowerCase());
        if (lowerCheck.includes('ferie') || lowerCheck.includes('férié')) {
          feriesSkipped++;
          continue;
        }

        const colorName = colorNameFor(fillArgb(prCell) || fillArgb(opCell));
        if (colorName === '__FERIE__') {
          feriesSkipped++;
          continue;
        }
        const resolvedStatut = (colorName && colorToStatut[colorName]) || colorName;

        rows.push({
          month, week_number: weekNumber, date: null, heure,
          operation, prestataire, code_postal: codePostal, commercial,
          critere, statut: resolvedStatut, sous_statut: null, client: null, raison_sociale: null, telephone: null, motif: null,
          _source_sheet: ws.name, _source_row: r, _week_label: block.label,
        });

        summary[month].total++;
        summary[month].parWeek[weekNumber] = (summary[month].parWeek[weekNumber] || 0) + 1;
        const c = colorName || '(sans couleur)';
        summary[month].parCouleur[c] = (summary[month].parCouleur[c] || 0) + 1;
      }
    });
  }

  return NextResponse.json({ rows, summary, skippedSheets, feriesSkipped });
}
