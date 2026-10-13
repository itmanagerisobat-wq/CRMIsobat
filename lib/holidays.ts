// Computes French metropolitan public holidays for a given year.
// Easter-based holidays use the standard Gauss algorithm.

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function frenchHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const holidays = [
    new Date(Date.UTC(year, 0, 1)),   // Jour de l'an
    addDays(easter, 1),               // Lundi de Paques
    new Date(Date.UTC(year, 4, 1)),   // Fete du travail
    new Date(Date.UTC(year, 4, 8)),   // Victoire 1945
    addDays(easter, 39),              // Ascension
    addDays(easter, 50),              // Lundi de Pentecote
    new Date(Date.UTC(year, 6, 14)),  // Fete nationale
    new Date(Date.UTC(year, 7, 15)),  // Assomption
    new Date(Date.UTC(year, 10, 1)),  // Toussaint
    new Date(Date.UTC(year, 10, 11)), // Armistice
    new Date(Date.UTC(year, 11, 25)), // Noel
  ];
  return new Set(holidays.map(toISODate));
}

export function isFrenchHoliday(dateISO: string): boolean {
  const year = parseInt(dateISO.slice(0, 4), 10);
  return frenchHolidays(year).has(dateISO);
}

export function isWeekend(dateISO: string): boolean {
  const d = new Date(dateISO + 'T00:00:00Z');
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}
