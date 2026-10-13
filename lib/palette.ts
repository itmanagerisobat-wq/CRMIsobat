// A wide, high-contrast palette -- no two adjacent shades of the same hue,
// so nothing gets confused visually even with many categories.
export const PALETTE = [
  '#0E8A3E', // forest green
  '#2196F3', // blue
  '#C9A227', // gold
  '#8B2FE0', // violet
  '#E4032E', // red
  '#FF6F00', // orange
  '#00838F', // teal
  '#AD1457', // pink/magenta
  '#558B2F', // olive green
  '#5D4037', // brown
  '#3949AB', // indigo
  '#00695C', // dark teal
  '#F9A825', // amber
  '#6D4C41', // dark brown
  '#455A64', // blue grey
];

/** Stable colour for a value: based on its position in the canonical list
 * (e.g. Parametres' operations order), NOT on its rank in a sorted chart --
 * so a given operation/status keeps the same colour across months even if
 * its volume (and therefore its position in a "sorted by total" list)
 * changes. */
export function colorForName(name: string, canonicalList: string[]): string {
  const idx = canonicalList.findIndex((v) => v.trim().toLowerCase() === name.trim().toLowerCase());
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
}
