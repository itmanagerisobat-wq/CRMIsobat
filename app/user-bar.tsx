'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRole, useDisplayName } from '@/lib/use-role';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', gestionnaire: 'Gestionnaire', viewer: 'Visualisation', agent: 'Agent',
  relanceur: 'Relanceur', responsable_b2c: 'Responsable B2C',
};

/** En haut a droite : interrupteur BtoB/BtoC (admin/gestionnaire) + menu du compte (Changer de compte / Se deconnecter). */
export default function UserBar({ univers }: { univers: 'b2b' | 'b2c' }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useRole();
  const displayName = useDisplayName();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (pathname?.startsWith('/login') || !role) return null;

  const accent = univers === 'b2c' ? '#65A30D' : '#C7070A';
  const label = displayName
    ? displayName.charAt(0).toUpperCase() + displayName.slice(1)
    : ROLE_LABEL[role] || '';

  function switchUnivers() {
    const next = univers === 'b2b' ? 'b2c' : 'b2b';
    document.cookie = `univers=${next}; path=/; max-age=31536000`;
    window.dispatchEvent(new Event('univers-changed'));
    router.refresh();
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4 shrink-0 pr-4">
      {(role === 'admin' || role === 'gestionnaire') && (
        <button
          onClick={switchUnivers}
          title="Changer d'univers de travail"
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-full px-3 py-1.5 text-xs font-bold text-white"
        >
          <span className={univers === 'b2b' ? 'opacity-100' : 'opacity-40'}>BtoB</span>
          <span className="w-6 h-3 rounded-full bg-white/40 relative inline-block">
            <span className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${univers === 'b2c' ? 'left-3.5' : 'left-0.5'}`} />
          </span>
          <span className={univers === 'b2c' ? 'opacity-100' : 'opacity-40'}>BtoC</span>
        </button>
      )}

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-white rounded-full px-4 py-1.5 whitespace-nowrap hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          {label} <span className="text-[10px]">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white text-ink rounded-lg shadow-xl border border-black/10 overflow-hidden z-[100]">
            <div className="px-4 py-2 text-xs text-ink/50 border-b border-black/5">
              {ROLE_LABEL[role] || ''}
            </div>
            {role !== 'agent' && role !== 'relanceur' && role !== 'responsable_b2c' && (
              <Link href="/parametres" onClick={() => setOpen(false)} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-forest-light/60">
                ⚙️ Paramètres
              </Link>
            )}
            {role === 'admin' && (
              <Link href="/backup" onClick={() => setOpen(false)} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-forest-light/60">
                💾 Sauvegarde
              </Link>
            )}
            <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm hover:bg-forest-light/60">
              🔄 Changer de compte
            </button>
            <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm hover:bg-forest-light/60 text-statut-annule">
              ⏻ Se deconnecter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
