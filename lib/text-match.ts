/** Lowercases and strips accents so "Reporte"/"Reporté", "annule"/"annulé" etc.
 * are treated the same regardless of how a Parametres value was typed. */
export function normalizeText(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function textIncludes(haystack: string | null | undefined, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}
