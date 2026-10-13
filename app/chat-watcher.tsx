'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/use-role';

function beep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch { /* ignore */ }
}

/** Presence heartbeat + compteur de messages non lus (badge du menu) + toast sur nouveau message. */
export default function ChatWatcher() {
  const role = useRole();
  const pathname = usePathname();
  const [toast, setToast] = useState(false);
  const last = useRef<number | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    async function tick() {
      try {
        const j = await fetch('/api/chat/state', { cache: 'no-store' }).then((r) => r.json());
        if (cancelled) return;
        const total = Object.values((j.unread || {}) as Record<string, number>).reduce((a, b) => a + b, 0);
        window.dispatchEvent(new CustomEvent('chat-unread', { detail: total }));
        if (last.current !== null && total > last.current && !pathRef.current?.startsWith('/chat')) {
          setToast(true);
          beep();
        }
        last.current = total;
      } catch { /* retry */ }
    }
    tick();
    const t = setInterval(tick, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, [role]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[200]">
      <Link href="/chat" onClick={() => setToast(false)} className="block bg-forest text-white rounded-lg shadow-xl px-4 py-3 text-sm font-medium">
        💬 Nouveau message — ouvrir la messagerie
      </Link>
    </div>
  );
}
