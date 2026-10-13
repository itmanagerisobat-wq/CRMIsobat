// Paris coordinates (Notre-Dame area, central reference point)
const PARIS_LAT = 48.8566;
const PARIS_LON = 2.3522;

interface Coords {
  lat: number;
  lon: number;
}

/** Geocode a French postal code to coordinates using the free BAN
 * (Base Adresse Nationale) API -- no key required. */
export async function geocodePostalCode(codePostal: string): Promise<Coords | null> {
  const cp = codePostal.replace(/\D/g, '').padStart(5, '0');
  if (cp.length !== 5) return null;
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${cp}&postcode=${cp}&type=municipality&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return null;
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lon };
  } catch {
    return null;
  }
}

/** Real driving distance (km) + duration (minutes) via OSRM between two
 * arbitrary coordinate pairs (not just to Paris). */
export async function routeBetween(a: Coords, b: Coords): Promise<{ km: number; minutes: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const meters = json.routes?.[0]?.distance;
    const seconds = json.routes?.[0]?.duration;
    if (typeof meters !== 'number' || typeof seconds !== 'number') return null;
    return { km: Math.round(meters / 1000), minutes: Math.round(seconds / 60) };
  } catch {
    return null;
  }
}

export async function routeBetweenPostalCodes(cp1: string, cp2: string): Promise<{ km: number; minutes: number } | null> {
  const [a, b] = await Promise.all([geocodePostalCode(cp1), geocodePostalCode(cp2)]);
  if (!a || !b) return null;
  return routeBetween(a, b);
}

/** Real driving distance (km) via the free OSRM public routing server. */
export async function drivingDistanceKm(coords: Coords): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coords.lon},${coords.lat};${PARIS_LON},${PARIS_LAT}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const meters = json.routes?.[0]?.distance;
    if (typeof meters !== 'number') return null;
    return Math.round(meters / 1000);
  } catch {
    return null;
  }
}

/** Straight-line fallback (Haversine) if OSRM is unreachable -- clearly
 * marked as approximate when used. */
function haversineKm(coords: Coords): number {
  const R = 6371;
  const dLat = ((PARIS_LAT - coords.lat) * Math.PI) / 180;
  const dLon = ((PARIS_LON - coords.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((coords.lat * Math.PI) / 180) * Math.cos((PARIS_LAT * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function distanceParisForPostalCode(codePostal: string): Promise<{ km: number; minutes: number | null; approx: boolean } | null> {
  const coords = await geocodePostalCode(codePostal);
  if (!coords) return null;
  const driving = await routeBetween(coords, { lat: PARIS_LAT, lon: PARIS_LON });
  if (driving !== null) return { km: driving.km, minutes: driving.minutes, approx: false };
  return { km: haversineKm(coords), minutes: null, approx: true };
}
