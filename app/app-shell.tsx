'use client';

import { usePathname } from 'next/navigation';
import NavBar from './nav-bar';
import GlobalSearch from './global-search';
import Clock from './clock';
import PendingRequestsWatcher from './pending-requests-watcher';
import ApRappelWatcher from './ap-rappel-watcher';
import B2cRdvWatcher from './b2c-rdv-watcher';
import ChatWatcher from './chat-watcher';
import RelanceRappelWatcher from './relance-rappel-watcher';

export default function AppShell({ children, univers }: { children: React.ReactNode; univers: 'b2b' | 'b2c' }) {
  const pathname = usePathname();
  const isLogin = pathname?.startsWith('/login');
  const hideSearch = pathname?.startsWith('/disponibilites') || pathname?.startsWith('/dashboard');

  if (isLogin) return <>{children}</>;

  return (
    <>
      <PendingRequestsWatcher />
      <ApRappelWatcher />
      <RelanceRappelWatcher />
      <ChatWatcher />
      <B2cRdvWatcher />
      <NavBar univers={univers} />
      <GlobalSearch />

      <main className="relative z-10 max-w-[1600px] mx-auto px-2 sm:px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 -ml-4">
            <div className="w-[100px] h-[100px] rounded-full bg-white border-2 border-forest/20 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-full h-full object-cover scale-110" />
            </div>
            <span className="text-sm font-semibold text-ink/50 tracking-wide">ISO BAT</span>
          </div>
          {!hideSearch && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
              className="flex-1 max-w-md mx-6 flex items-center gap-2 text-ink/40 hover:text-ink/60 bg-white border border-black/10 hover:border-black/20 rounded-md px-4 py-2 text-sm transition-colors"
            >
              🔍 Rechercher un client, commercial, telephone...
            </button>
          )}
          <Clock />
        </div>
        {children}
      </main>
    </>
  );
}
