'use client';

import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

interface Props {
  counts: Record<string, number>; // region name -> count
}

const GEO_URL = '/regions.geojson';

// short display names for cramped regions
const SHORT_NAME: Record<string, string> = {
  'Provence-Alpes-Cote d\'Azur': 'PACA',
  'Bourgogne-Franche-Comte': 'Bourgogne-FC',
  'Auvergne-Rhone-Alpes': 'Auvergne-RA',
  'Nouvelle-Aquitaine': 'Nvelle-Aquitaine',
};

// smooth green gradient instead of 3 hard bands
function colorScale(n: number, max: number) {
  if (n === 0) return '#F2F5F2';
  const t = Math.min(1, max > 0 ? n / max : 0);
  const stops: [number, [number, number, number]][] = [
    [0, [214, 233, 219]],
    [0.5, [122, 189, 140]],
    [1, [11, 92, 51]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const span = hi[0] - lo[0] || 1;
  const localT = (t - lo[0]) / span;
  const rgb = lo[1].map((c, i) => Math.round(c + (hi[1][i] - c) * localT));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function textColorFor(n: number, max: number) {
  const t = max > 0 ? n / max : 0;
  return t > 0.55 ? '#FFFFFF' : '#0E3B1F';
}

export default function FranceRegionMap({ counts }: Props) {
  const [geoData, setGeoData] = useState<any>(null);
  const [hover, setHover] = useState<{ x: number; y: number; name: string; n: number; pct: number } | null>(null);

  useEffect(() => {
    fetch(GEO_URL).then((r) => r.json()).then(setGeoData);
  }, []);

  const values = Object.values(counts);
  const max = Math.max(1, ...values);
  const total = values.reduce((s, v) => s + v, 0);

  const rows = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!geoData) {
    return <div className="h-[420px] flex items-center justify-center text-ink/40 text-sm">Chargement de la carte...</div>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 relative">
        {/* legend */}
        <div className="flex items-center gap-2 mb-3 text-xs text-ink/60">
          <span>Faible</span>
          <span className="flex-1 h-2 rounded-full max-w-[160px]" style={{
            background: 'linear-gradient(90deg, rgb(214,233,219), rgb(122,189,140), rgb(11,92,51))',
          }} />
          <span>Fort</span>
          <span className="flex items-center gap-1 ml-3">
            <span className="w-2.5 h-2.5 rounded-sm inline-block border border-black/10" style={{ background: '#F2F5F2' }} />
            Aucun RDV
          </span>
        </div>

        <div className="rounded-xl shadow-md bg-white p-3 relative">
          <ComposableMap
            projection="geoConicConformal"
            projectionConfig={{ center: [2.5, 46.5], scale: 2600 }}
            width={560}
            height={520}
            style={{ width: '100%', height: 'auto' }}
          >
            <Geographies geography={geoData}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo) => {
                  const name = geo.properties.nom;
                  const n = counts[name] || 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={colorScale(n, max)}
                      stroke="#ffffff"
                      strokeWidth={1.4}
                      onMouseEnter={(e: React.MouseEvent) => {
                        setHover({
                          x: e.clientX, y: e.clientY, name, n,
                          pct: total ? Math.round((n / total) * 100) : 0,
                        });
                      }}
                      onMouseMove={(e: React.MouseEvent) => {
                        setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
                      }}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        default: { outline: 'none', transition: 'fill 150ms ease' },
                        hover: { outline: 'none', fill: '#C9A227', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {geoData.features.map((geo: any) => {
              const name = geo.properties.nom;
              const n = counts[name] || 0;
              if (n === 0) return null;
              const centroid = regionCentroid(geo);
              if (!centroid) return null;
              const label = SHORT_NAME[name] || name;
              const tColor = textColorFor(n, max);
              return (
                <Marker key={geo.properties.code} coordinates={centroid}>
                  <text
                    textAnchor="middle"
                    y={-4}
                    fontSize={9}
                    fontWeight={600}
                    fill={tColor}
                    style={{ pointerEvents: 'none' }}
                  >
                    {label}
                  </text>
                  <text
                    textAnchor="middle"
                    y={10}
                    fontSize={14}
                    fontWeight={800}
                    fill={tColor}
                    style={{ pointerEvents: 'none' }}
                  >
                    {n}
                  </text>
                </Marker>
              );
            })}
          </ComposableMap>
        </div>

        {hover && (
          <div
            className="fixed z-50 bg-ink text-white text-xs px-3 py-2 rounded-md shadow-lg pointer-events-none"
            style={{ left: hover.x + 14, top: hover.y + 14 }}
          >
            <div className="font-semibold">{hover.name}</div>
            <div className="text-white/80">{hover.n} RDV ({hover.pct}%)</div>
          </div>
        )}
      </div>

      {/* summary table */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-2">Recapitulatif</h3>
        <div className="border border-black/10 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-forest-light text-forest-dark">
                <th className="px-2 py-1.5 text-left">Region</th>
                <th className="px-2 py-1.5 text-right">Nb</th>
                <th className="px-2 py-1.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, n]) => (
                <tr key={name} className="border-t border-black/5">
                  <td className="px-2 py-1.5">{name}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{n}</td>
                  <td className="px-2 py-1.5 text-right text-ink/50">
                    {total ? Math.round((n / total) * 100) : 0}%
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-2 py-3 text-center text-ink/40">Aucune donnee</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-black/10 font-semibold bg-forest-light/40">
                  <td className="px-2 py-1.5">Total</td>
                  <td className="px-2 py-1.5 text-right">{total}</td>
                  <td className="px-2 py-1.5 text-right">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// simple polygon centroid (averages ring points) -- good enough for label placement
function regionCentroid(geo: any): [number, number] | null {
  try {
    const geom = geo.geometry;
    let coords: number[][] = [];
    if (geom.type === 'Polygon') {
      coords = geom.coordinates[0];
    } else if (geom.type === 'MultiPolygon') {
      let best: number[][] = [];
      for (const poly of geom.coordinates) {
        if (poly[0].length > best.length) best = poly[0];
      }
      coords = best;
    }
    if (!coords.length) return null;
    let x = 0, y = 0;
    for (const [lon, lat] of coords) { x += lon; y += lat; }
    return [x / coords.length, y / coords.length];
  } catch {
    return null;
  }
}
