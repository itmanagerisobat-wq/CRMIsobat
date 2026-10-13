'use client';

import { useEffect, useState } from 'react';
import { REGIONS } from '@/lib/regions';

interface Zone {
  id: string;
  commercial: string;
  region_code: string;
}
interface Base {
  commercial: string;
  code_postal: string;
}

export default function CommercialZonesSection({ commerciaux }: { commerciaux: string[] }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [baseDraft, setBaseDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCommercial, setSelectedCommercial] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const [zRes, bRes] = await Promise.all([
      fetch('/api/commercial-zones', { cache: 'no-store' }),
      fetch('/api/commercial-base', { cache: 'no-store' }),
    ]);
    const zJson = await zRes.json();
    const bJson = await bRes.json();
    setZones(zJson.data || []);
    setBases(bJson.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addZone() {
    if (!selectedCommercial || !selectedRegion) return;
    setAdding(true);
    await fetch('/api/commercial-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commercial: selectedCommercial, region_code: selectedRegion }),
    });
    setAdding(false);
    setSelectedRegion('');
    load();
  }

  async function removeZone(id: string) {
    await fetch(`/api/commercial-zones/${id}`, { method: 'DELETE' });
    load();
  }

  async function saveBase(commercial: string) {
    const cp = baseDraft[commercial];
    if (!cp?.trim()) return;
    await fetch('/api/commercial-base', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commercial, code_postal: cp.trim() }),
    });
    load();
  }

  const zonesByCommercial: Record<string, Zone[]> = {};
  for (const z of zones) (zonesByCommercial[z.commercial] = zonesByCommercial[z.commercial] || []).push(z);
  const baseByCommercial: Record<string, string> = {};
  for (const b of bases) baseByCommercial[b.commercial] = b.code_postal;

  return (
    <div className="bg-white rounded-lg border border-black/5 p-4">
      <h2 className="font-semibold text-ink mb-1">Zones geographiques par commercial</h2>
      <p className="text-xs text-ink/50 mb-3">
        Un commercial sans region assignee ici couvre toute la France. Sinon, il n'est propose
        par "Prise de RDV" que pour les regions listees. Le code postal de base sert de point de
        depart quand aucun autre RDV n'existe encore ce jour-la.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={selectedCommercial} onChange={(e) => setSelectedCommercial(e.target.value)} className="border border-black/10 rounded-md px-3 py-1.5 text-sm bg-white">
          <option value="">-- commercial --</option>
          {commerciaux.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="border border-black/10 rounded-md px-3 py-1.5 text-sm bg-white">
          <option value="">-- region --</option>
          {Object.entries(REGIONS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <button onClick={addZone} disabled={adding || !selectedCommercial || !selectedRegion} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-3 rounded-md disabled:opacity-50">
          Assigner
        </button>
      </div>

      {loading && <p className="text-sm text-ink/40">Chargement...</p>}
      {!loading && commerciaux.map((c) => {
        const mine = zonesByCommercial[c] || [];
        return (
          <div key={c} className="flex items-center justify-between py-1.5 text-sm border-t border-black/5 first:border-t-0 flex-wrap gap-2">
            <span className="font-medium">{c}</span>
            <div className="flex items-center gap-2">
              <input
                value={baseDraft[c] ?? baseByCommercial[c] ?? ''}
                onChange={(e) => setBaseDraft((d) => ({ ...d, [c]: e.target.value }))}
                onBlur={() => saveBase(c)}
                placeholder="Code postal de base"
                className="border border-black/10 rounded px-2 py-1 text-xs w-32"
              />
              {mine.length === 0 && <span className="text-xs text-ink/40 italic">Toute la France</span>}
              {mine.map((z) => (
                <span key={z.id} className="text-xs bg-forest-light text-forest-dark rounded-full px-2 py-0.5 flex items-center gap-1">
                  {REGIONS[z.region_code] || z.region_code}
                  <button onClick={() => removeZone(z.id)} className="text-forest-dark/50 hover:text-statut-annule">×</button>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
