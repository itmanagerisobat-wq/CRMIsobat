const MOIS_FR: Record<string, number> = {
  Janvier: 1, Fevrier: 2, Mars: 3, Avril: 4, Mai: 5, Juin: 6,
  Juillet: 7, Aout: 8, Septembre: 9, Octobre: 10, Novembre: 11, Decembre: 12,
};

export function parseMonth(month: string): { year: number; monthNum: number } {
  const [name, yearStr] = month.split(' ');
  return { year: parseInt(yearStr, 10), monthNum: MOIS_FR[name] };
}

/** Monday-Friday business weeks, clipped to stay within the calendar month
 * (mirrors the logic used to build the Excel workbook). */
export function monthWeeks(month: string): { start: Date; end: Date }[] {
  const { year, monthNum } = parseMonth(month);
  if (!monthNum) return [];
  const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const monthEnd = new Date(Date.UTC(year, monthNum, 0));
  const weeks: { start: Date; end: Date }[] = [];

  let d = new Date(monthStart);
  while (d <= monthEnd) {
    const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - dow);
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 4);

    const start = monday < monthStart ? monthStart : monday;
    const end = friday > monthEnd ? monthEnd : friday;

    if (start <= end) weeks.push({ start: new Date(start), end: new Date(end) });

    d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + 7);
  }
  return weeks;
}

export function formatDDMM(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Numero de semaine (1..n) du Planning pour une date ISO (YYYY-MM-DD) dans son mois.
 * Les semaines vont du lundi au vendredi : un samedi / dimanche est rattache a la semaine qui vient de se terminer
 * (ou a la premiere semaine du mois s'il n'y en a pas avant). */
export function weekNumberForDate(month: string, iso: string): number {
  const ranges = monthWeeks(month);
  if (ranges.length === 0) return 1;
  const t = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  const inside = ranges.findIndex((r) => t >= r.start && t <= r.end);
  if (inside >= 0) return inside + 1;
  let before = -1;
  ranges.forEach((r, i) => { if (r.end < t) before = i; });
  return before >= 0 ? before + 1 : 1;
}
