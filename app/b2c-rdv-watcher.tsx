'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRole } from '@/lib/use-role';
import { useUnivers } from '@/lib/use-univers';

const KEY = 'isobat_seen_b2c_rdv';

function loadSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}
function saveSeen(ids: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(ids))); } catch { /* ignore */ }
}
function beep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch { /* ignore */ }
}

/** Responsable B2C / admin / gestionnaire (en BtoC) : notification a chaque nouveau RDV saisi par un agent B2C. */
export default function B2cRdvWatcher() {
  const role = useRole();
  const univers = useUnivers();
  const [toast, setToast] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const ok = role === 'responsable_b2c' || ((role === 'admin' || role === 'gestionnaire') && univers === 'b2c');
    if (!ok) return;
    let cancelled = false;
    async function check() {
      try {
        const j = await fetch('/api/b2c-rdv', { cache: 'no-store' }).then((r) => r.json());
        if (cancelled) return;
        const rows: any[] = (j.data || []).filter((r: any) => !r.valide_at);
        const seen = loadSeen();
        const fresh = rows.filter((r) => !seen.has(r.id));
        if (fresh.length > 0 && !first.current) {
          setToast(`${fresh.length} nouveau${fresh.length > 1 ? 'x' : ''} RDV B2C envoye${fresh[0].agent_name ? ' (' + fresh[0].agent_name + ')' : ''}`);
          beep();
        }
        first.current = false;
        rows.forEach((r) => seen.add(r.id));
        saveSeen(seen);
      } catch { /* retry */ }
    }
    check();
    const t = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [role, univers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
      <Link href="/rdv-agents" onClick={() => setToast(null)} className="block bg-forest text-white rounded-lg shadow-xl p-4 text-sm font-medium">
        🆕 {toast} — ouvrir RDV agents
      </Link>
    </div>
  );
}
