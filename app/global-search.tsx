'use client';

import { useEffect, useState } from 'react';
import { Rdv } from '@/lib/types';

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Rdv[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    function onOpenEvent() { setOpen(true); }
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-global-search', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-global-search', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      fetch('/api/rdv', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setRows(j.data || []); setLoaded(true); });
    }
  }, [open, loaded]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const results = q
    ? rows.filter((r) =>
        (r.client || '').toLowerCase().includes(q) ||
        (r.raison_sociale || '').toLowerCase().includes(q) ||
        (r.commercial || '').toLowerCase().includes(q) ||
        (r.prestataire || '').toLowerCase().includes(q) ||
        (r.telephone || '').toLowerCase().includes(q) ||
        (r.code_postal || '').toLowerCase().includes(q)
      ).slice(0, 30)
    : [];

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un client, commercial, prestataire, telephone, code postal... (Echap pour fermer)"
          className="w-full px-4 py-3 text-sm border-b border-black/10 focus:outline-none rounded-t-lg"
        />
        <div className="max-h-96 overflow-y-auto">
          {q && results.length === 0 && (
            <p className="text-sm text-ink/40 p-4">Aucun resultat.</p>
          )}
          {results.map((r) => (
            <a
              key={r.id}
              href={`/planning?month=${encodeURIComponent(r.month)}`}
              className="block px-4 py-2.5 text-sm hover:bg-forest-light border-b border-black/5 last:border-0"
            >
              <div className="font-medium">{r.client || r.raison_sociale || 'Sans nom'}</div>
              <div className="text-ink/50 text-xs">
                {r.commercial || '—'} · {r.prestataire || '—'} · {r.month} · {r.telephone || ''}
              </div>
            </a>
          ))}
          {!q && (
            <p className="text-sm text-ink/40 p-4">Tape pour chercher dans tous les RDV.</p>
          )}
        </div>
      </div>
    </div>
  );
}
