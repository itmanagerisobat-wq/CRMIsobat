'use client';

import { useEffect, useRef, useState } from 'react';
import { useRole } from '@/lib/use-role';
import { useUnivers } from '@/lib/use-univers';

interface Req {
  id: string;
  date: string;
  heure: string;
  agent_name: string | null;
}

const SEEN_KEY = 'isobat_seen_rdv_request_ids';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // storage unavailable -- fail silently
  }
}

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // audio not available (e.g. no user interaction yet) -- fail silently
  }
}

/**
 * Global, cross-page watcher for pending "Prise de RDV" requests sent by
 * prospecting agents. Mounted once in AppShell so the gestionnaire/admin
 * gets the toast + sound alert no matter which page they're on, and even
 * if the request was already pending before they opened the app (seen
 * state is tracked in localStorage rather than only in-memory).
 */
export default function PendingRequestsWatcher() {
  const role = useRole();
  const univers = useUnivers();
  const [toast, setToast] = useState<Req | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (role !== 'admin' && role !== 'gestionnaire') return;
    if (univers !== 'b2b') return; // B2C : notifie par b2c-rdv-watcher

    cancelledRef.current = false;

    async function check() {
      try {
        const res = await fetch('/api/rdv-requests?status=pending&univers=b2b', { cache: 'no-store' });
        const json = await res.json();
        const data: Req[] = json.data || [];
        if (cancelledRef.current) return;

        const seen = loadSeen();
        const currentIds = new Set(data.map((r) => r.id));
        const fresh = data.find((r) => !seen.has(r.id));

        if (fresh) {
          setToast(fresh);
          playNotificationSound();
        }

        // keep the seen set in sync with what's actually pending -- mark
        // everything currently pending as seen, and drop ids that are no
        // longer pending (validated/refused) so the set doesn't grow forever
        const nextSeen = new Set(Array.from(seen).filter((id) => currentIds.has(id)));
        data.forEach((r) => nextSeen.add(r.id));
        saveSeen(nextSeen);
      } catch {
        // network hiccup -- next poll will retry
      }
    }

    check();
    const t = setInterval(check, 15000);
    return () => {
      cancelledRef.current = true;
      clearInterval(t);
    };
  }, [role, univers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
      <div className="bg-forest text-white rounded-lg shadow-xl p-4 text-sm font-medium flex items-start justify-between gap-3">
        <span>
          🔔 Nouvelle demande de RDV envoyee par <strong>{toast.agent_name || 'un agent'}</strong>
          {' '}({new Date(toast.date).toLocaleDateString('fr-FR')} · {toast.heure})
        </span>
        <button onClick={() => setToast(null)} className="shrink-0 opacity-80 hover:opacity-100">×</button>
      </div>
    </div>
  );
}
