'use client';

import { useCallback, useEffect, useState } from 'react';
import { Rdv } from '@/lib/types';
import { isHonore } from '@/lib/b2c-flow';

export interface FileMeta { id: string; rdv_id: string; kind: string; filename: string }

/** RDV B2C honores (= visites faites) + parametres papiers/installation + pieces jointes. */
export function useB2cDossiers() {
  const [rows, setRows] = useState<Rdv[]>([]);
  const [params, setParams] = useState<Record<string, string[]>>({});
  const [files, setFiles] = useState<Record<string, FileMeta[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [r, p, f] = await Promise.all([
      fetch('/api/rdv', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/rdv-files', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({ data: [] })),
    ]);
    const prm: Record<string, string[]> = p.data || {};
    const norm = (v: string | null | undefined) => (v || '').trim().toLowerCase();
    const entry = (prm.visite_vers_papiers || []).map(norm);
    // un dossier entre en Recuperation des papiers quand le resultat de la visite (statut ou sous-statut) est dans la liste Parametres
    setRows((r.data || []).filter((x: Rdv) => x.type_client === 'b2c' && isHonore(x.statut)
      && (entry.includes(norm(x.sous_statut)) || entry.includes(norm(x.statut)) || !!x.papiers_statut)));
    setParams(prm);
    const map: Record<string, FileMeta[]> = {};
    (f.data || []).forEach((x: FileMeta) => { (map[x.rdv_id] ||= []).push(x); });
    setFiles(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  return { rows, params, files, loading, reload: load };
}

export async function patchRdv(id: string, body: Record<string, any>): Promise<string | null> {
  const res = await fetch(`/api/rdv/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const j = await res.json().catch(() => ({})); return j.error || 'Erreur'; }
  return null;
}
