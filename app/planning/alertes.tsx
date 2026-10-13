'use client';

import { useEffect, useState, useRef } from 'react';
import { Rdv } from '@/lib/types';
import { useUnivers } from '@/lib/use-univers';

export default function Alertes() {
  const univers = useUnivers();
  const univRef = useRef(univers);
  univRef.current = univers;
  const [rows, setRows] = useState<Rdv[]>([]);
  const [todayIds, setTodayIds] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    fetch('/api/rdv', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (univRef.current !== univers) return; setRows((j.data || []).filter((r: Rdv) => (r.type_client || 'b2b') === univers)); });
    fetch('/api/relance-log/today', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => univRef.current === univers && setTodayIds((j.data || []).map((l: any) => l.rdv_id)));

    function loadPending() {
      const url = univers === 'b2c' ? '/api/b2c-rdv' : '/api/rdv-requests?status=pending&univers=b2b';
      fetch(url, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => univRef.current === univers && setPendingRequests((j.data || []).filter((x: any) => univers !== 'b2c' || !x.valide_at).length));
    }
    loadPending();
    window.addEventListener('rdv-requests-changed', loadPending);
    return () => window.removeEventListener('rdv-requests-changed', loadPending);
  }, [univers]);

  const relancesToday = rows.filter((r) => todayIds.includes(r.id)).length; // uniquement l'univers affiche
  const honoreSansSousStatut = rows.filter((r) => r.statut === 'honore' && !r.sous_statut);


  if (relancesToday === 0 && honoreSansSousStatut.length === 0 && pendingRequests === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-2">
      {pendingRequests > 0 && (
        <div className="bg-forest-light border border-forest/30 rounded-md px-4 py-2.5 text-sm flex items-center justify-between">
          <span>
            📨 <strong>{pendingRequests}</strong> demande(s) de RDV envoyee(s) par les agents, en attente de validation.
          </span>
          <span className="text-forest text-xs font-medium">Voir en haut de page ↑</span>
        </div>
      )}
      {relancesToday > 0 && (
        <div className="bg-gold-light border border-gold/30 rounded-md px-4 py-2.5 text-sm flex items-center justify-between">
          <span>
            🔔 <strong>{relancesToday}</strong> relance(s) prevue(s) aujourd'hui.
          </span>
          <a href="/relance" className="text-forest underline text-xs">Voir</a>
        </div>
      )}
      {honoreSansSousStatut.length > 0 && (
        <div className="bg-statut-annule/10 border border-statut-annule/20 rounded-md px-4 py-2.5 text-sm flex items-center justify-between">
          <span>
            ⚠️ <strong>{honoreSansSousStatut.length}</strong> RDV honore(s) sans sous-statut renseigne.
          </span>
          <a href="/planning" className="text-forest underline text-xs">Voir</a>
        </div>
      )}
    </div>
  );
}
