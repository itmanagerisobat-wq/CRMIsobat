import { randomInt } from 'crypto';

const WORDS = ['soleil','cedre','olivier','jasmin','citron','figuier','sable','rivage','nuage','etoile','lavande','menthe','oasis','corail','ambre','cannelle','orange','mimosa','safran','pivoine','tulipe','cypres','erable','bambou','sapin','lilas','granit','marbre','cuivre','argent','zenith','horizon','brise','aurore','cascade','falaise','prairie','colline','vallon','ruisseau','galet','dune','lagon','phare','voilier','navire','boussole','balise','sentier','verger','jardin','fontaine','source','torrent','rocher','plateau','canyon','ocean','delta','fjord'];

function pick<T>(a: T[]): T { return a[randomInt(a.length)]; }

/** Mot de passe lisible et facile a taper au telephone : mot-mot-mot-123 */
export function generatePassword(): string {
  const w = [pick(WORDS), pick(WORDS), pick(WORDS)];
  return `${w.join('-')}-${String(randomInt(100, 1000))}`;
}

export function slugUsername(name: string): string {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return `${s || 'agent'}@isobat.crm`;
}
