'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRole } from '@/lib/use-role';
import UserBar from './user-bar';

const AGENT_LINKS_B2B = [
  { href: '/disponibilites', label: 'Prise de RDV' },
  { href: '/accords-principe', label: 'Accords de principe' },
  { href: '/carte', label: 'Carte' },
  { href: '/chat', label: 'Messagerie' },
];

const AGENT_LINKS_B2C = [
  { href: '/mes-rdv-b2c', label: 'Mes RDV' },
  { href: '/accords-principe', label: 'Accords de principe' },
  { href: '/carte', label: 'Carte' },
  { href: '/chat', label: 'Messagerie' },
];

const LINKS: { href: string; label: string; adminOnly?: boolean; b2cOnly?: boolean; carteRole?: boolean }[] = [
  { href: '/planning', label: 'Planning' },
  { href: '/calendrier', label: 'Calendrier' },
  { href: '/itineraire', label: 'Itineraire' },
  { href: '/carte', label: 'Carte', carteRole: true },
  { href: '/relance', label: 'Relance' },
  { href: '/papiers', label: 'Récup. papiers', b2cOnly: true },
  { href: '/installation', label: 'Installation', b2cOnly: true },
  { href: '/clients', label: 'Fiche client', adminOnly: true },
  { href: '/dashboard', label: 'Statistiques' },
  { href: '/chat', label: 'Messagerie' },
];

export default function NavBar({ univers }: { univers: 'b2b' | 'b2c' }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();
  const [pendingCount, setPendingCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const h = (e: Event) => setChatUnread((e as CustomEvent).detail || 0);
    window.addEventListener('chat-unread', h);
    return () => window.removeEventListener('chat-unread', h);
  }, []);

  useEffect(() => {
    if (role !== 'admin' && role !== 'gestionnaire') return;
    let cancelled = false;
    function load() {
      const url = univers === 'b2c' ? '/api/b2c-rdv' : '/api/rdv-requests?status=pending&univers=b2b';
      fetch(url, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => { if (!cancelled) setPendingCount((j.data || []).filter((x: any) => univers !== 'b2c' || !x.valide_at).length); })
        .catch(() => {});
    }
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('rdv-requests-changed', load);
    return () => { cancelled = true; clearInterval(t); window.removeEventListener('rdv-requests-changed', load); };
  }, [role, univers]);

  if (pathname?.startsWith('/login')) return null;

  const visibleLinks = role === 'agent'
    ? (univers === 'b2c' ? AGENT_LINKS_B2C : AGENT_LINKS_B2B)
    : role === 'responsable_b2c'
    ? LINKS.filter((l) => ['/planning', '/calendrier', '/relance', '/papiers', '/installation', '/carte', '/dashboard', '/chat'].includes(l.href))
    : LINKS.filter((l) => !l.adminOnly || role === 'admin').filter((l) => !(role === 'relanceur' && l.href === '/parametres')).filter((l) => !l.b2cOnly || univers === 'b2c').filter((l) => !(l.carteRole && (role === 'admin' || role === 'gestionnaire')));

  return (
    <header className="bg-forest text-white relative" style={{ overflowX: 'clip' }}>
      <div className="relative max-w-[1600px] mx-auto pl-0 pr-0 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={role === 'agent' ? (univers === 'b2c' ? '/mes-rdv-b2c' : '/disponibilites') : role === 'responsable_b2c' ? '/relance' : (role === 'admin' || role === 'gestionnaire') ? '/planning' : '/carte'}
            className="flex items-center gap-2 shrink-0 h-14 pl-5 pr-4"
            style={{ backgroundColor: univers === 'b2c' ? '#65A30D' : '#C7070A' }}
          >
            <div className="bg-white rounded-md p-1 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ISO BAT" width={44} height={44} className="rounded-sm" style={{ imageRendering: 'auto' }} />
            </div>
            <span className="font-semibold tracking-wide hidden sm:inline">ISO BAT</span>
          </Link>
          <nav className="flex items-center gap-0.5">
            {visibleLinks.map((l) => {
              const active = pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                    active ? '' : 'hover:bg-white/10'
                  }`}
                  style={active ? { backgroundColor: univers === 'b2c' ? '#65A30D' : '#C7070A' } : undefined}
                >
                  {l.label}
                  {l.href === '/chat' && chatUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {chatUnread}
                    </span>
                  )}
                  {l.href === '/planning' && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserBar univers={univers} />
      </div>
    </header>
  );
}
