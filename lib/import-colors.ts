// Maps the ARGB hex codes found in the legacy Excel files to French colour
// names. The user renames these to the real statut afterwards (in the app).
export const COLOR_NAMES: Record<string, string> = {
  FF00FF00: 'Vert',
  FF92D050: 'Vert',
  FFB6D7A8: 'Vert clair',
  FFFF00FF: 'Rose',
  FFFF0000: 'Rouge',
  FFFF9900: 'Orange',
  FFFFC000: 'Orange',
  FFFFFF00: 'Jaune',
  FF0070C0: 'Bleu',
  FF00B0F0: 'Bleu clair',
  FF7030A0: 'Violet',
};

// Cells filled with this colour mark a public holiday note ("ferie"), not an
// actual RDV -- rows using it are skipped entirely during import.
export const HOLIDAY_COLOR = 'FF000000';

export function colorNameFor(argb: string | undefined | null): string | null {
  if (!argb) return null;
  if (argb === 'FFFFFFFF' || argb === '00000000') return null; // white / no fill
  if (argb === HOLIDAY_COLOR) return '__FERIE__';
  return COLOR_NAMES[argb] || `Couleur ${argb.slice(2)}`;
}

const MOIS_CAP: Record<string, string> = {
  JANVIER: 'Janvier', FEVRIER: 'Fevrier', MARS: 'Mars', AVRIL: 'Avril', MAI: 'Mai',
  JUIN: 'Juin', JUILLET: 'Juillet', AOUT: 'Aout', SEPTEMBRE: 'Septembre',
  OCTOBRE: 'Octobre', NOVEMBRE: 'Novembre', DECEMBRE: 'Decembre',
};

/** "JUILLET 2026" -> "Juillet 2026" (matches the app's canonical MONTHS list) */
export function normalizeMonthName(sheetName: string): string | null {
  const m = sheetName.trim().toUpperCase().match(/([A-ZÉÛ]+)\s+(\d{4})/);
  if (!m) return null;
  const name = MOIS_CAP[m[1]];
  if (!name) return null;
  return `${name} ${m[2]}`;
}
