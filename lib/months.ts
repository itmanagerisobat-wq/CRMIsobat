export const MOIS_NOMS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

/** Builds "Aout 2026" from (2026, 8). monthNum is 1-12. */
export function buildMonthLabel(year: number, monthNum: number): string {
  return `${MOIS_NOMS[monthNum - 1]} ${year}`;
}

export function parseMonthLabel(label: string): { year: number; monthNum: number } | null {
  const [name, yearStr] = label.split(' ');
  const idx = MOIS_NOMS.indexOf(name);
  if (idx === -1 || !yearStr) return null;
  return { year: parseInt(yearStr, 10), monthNum: idx + 1 };
}

/** Range of selectable years in the Year dropdown (kept wide so older
 * imported data and future years are always reachable). */
export function selectableYears(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 3; y <= current + 3; y++) years.push(y);
  return years;
}
