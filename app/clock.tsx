'use client';

import { useEffect, useState } from 'react';

export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="text-right shrink-0">
      <div className="text-3xl font-black text-ink tabular-nums">{time}</div>
      <div className="text-sm font-bold text-ink capitalize">{date}</div>
    </div>
  );
}
