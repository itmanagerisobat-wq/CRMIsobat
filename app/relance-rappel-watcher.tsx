'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRole } from '@/lib/use-role';
import { useUnivers } from '@/lib/use-univers';

interface Due { id: string; type: 'relance' | 'ap'; label: string; date: string }

const KEY = 'isobat_relance_rappel_notified';
const today = () => new Date().toISOString().slice(0, 10);

function load(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function save(m: Record<string, string>) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}
function beep() {
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
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch { /* ignore */ }
}

/** Relanceur / admin / gestionnaire : rappels de relance et d'accords de principe du jour (ou en retard). Re-notifie une fois par jour. */
export default function RelanceRappelWatcher() {
  const role = useRole();
  const univers = useUnivers();
  const [toast, setToast] = useState<Due[] | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (role !== 'relanceur' && role !== 'responsable_b2c' && role !== 'admin' && role !== 'gestionnaire') return;
    cancelled.current = false;

    async function check() {
      try {
        const j = await fetch(`/api/relance-rappels?univers=${univers}`, { cache: 'no-store' }).then((r) => r.json());
        if (cancelled.current) return;
        const due: Due[] = j.data || [];
        const t = today();
        const notified = load();
        const fresh = due.filter((d) => notified[d.type + d.id] !== t);
        if (fresh.length > 0) { setToast(fresh); beep(); }
        const next: Record<string, string> = {};
        due.forEach((d) => { next[d.type + d.id] = t; });
        save(next);
      } catch { /* retry on next poll */ }
    }
    check();
    const i = setInterval(check, 60000);
    return () => { cancelled.current = true; clearInterval(i); };
  }, [role, univers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 12000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const nr = toast.filter((d) => d.type === 'relance').length;
  const na = toast.filter((d) => d.type === 'ap').length;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
      <div className="bg-gold text-white rounded-lg shadow-xl p-4 text-sm font-medium flex items-start justify-between gap-3">
        <div>
          <div>⏰ Rappels a faire :{nr > 0 ? ` ${nr} relance${nr > 1 ? 's' : ''}` : ''}{nr > 0 && na > 0 ? ' ·' : ''}{na > 0 ? ` ${na} accord${na > 1 ? 's' : ''} de principe` : ''}</div>
          <div className="text-xs font-normal opacity-90 mt-1">
            {toast.slice(0, 3).map((d) => d.label).join(', ')}{toast.length > 3 ? '…' : ''}
          </div>
          <Link href="/relance" onClick={() => setToast(null)} className="underline text-xs mt-1 inline-block">Ouvrir Relance</Link>
        </div>
        <button onClick={() => setToast(null)} className="shrink-0 opacity-80 hover:opacity-100">×</button>
      </div>
    </div>
  );
}
