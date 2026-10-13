'use client';

import { useEffect, useRef, useState } from 'react';
import { useRole } from '@/lib/use-role';

interface Item {
  id: string;
  raison_sociale: string | null;
  client: string | null;
  statut: string | null;
  date_prochain_rappel: string | null;
}

const NOTIFIED_KEY = 'isobat_ap_rappel_notified';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadNotified(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotified(map: Record<string, string>) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
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
 * Global watcher (agent only) for accords de principe due for a rappel
 * today or overdue. Re-notifies once per day per entry (tracked in
 * localStorage) until the agent changes its statut/date, so a rappel that's
 * still pending keeps resurfacing rather than being silenced forever after
 * the first toast.
 */
export default function ApRappelWatcher() {
  const role = useRole();
  const [toast, setToast] = useState<Item | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (role !== 'agent') return;

    cancelledRef.current = false;

    async function check() {
      try {
        const [apRes, paramsRes] = await Promise.all([
          fetch('/api/accords-principe', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/parametres', { cache: 'no-store' }).then((r) => r.json()),
        ]);
        if (cancelledRef.current) return;

        const rappelStatuts: string[] = paramsRes.data?.statuts_ap_rappel || [];
        const items: Item[] = apRes.data || [];
        const today = todayStr();

        const due = items.filter((it) =>
          it.statut && rappelStatuts.includes(it.statut) &&
          it.date_prochain_rappel && it.date_prochain_rappel <= today
        );

        const notified = loadNotified();
        const dueIds = new Set(due.map((it) => it.id));
        const fresh = due.find((it) => notified[it.id] !== today);

        if (fresh) {
          setToast(fresh);
          playNotificationSound();
        }

        const nextNotified: Record<string, string> = {};
        for (const id of Object.keys(notified)) {
          if (dueIds.has(id)) nextNotified[id] = notified[id];
        }
        due.forEach((it) => { nextNotified[it.id] = today; });
        saveNotified(nextNotified);
      } catch {
        // network hiccup -- next poll will retry
      }
    }

    check();
    const t = setInterval(check, 60000);
    return () => {
      cancelledRef.current = true;
      clearInterval(t);
    };
  }, [role]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
      <div className="bg-gold text-white rounded-lg shadow-xl p-4 text-sm font-medium flex items-start justify-between gap-3">
        <span>
          ⏰ Rappel a faire aujourd'hui : <strong>{toast.raison_sociale || toast.client || 'Client'}</strong>
        </span>
        <button onClick={() => setToast(null)} className="shrink-0 opacity-80 hover:opacity-100">×</button>
      </div>
    </div>
  );
}
