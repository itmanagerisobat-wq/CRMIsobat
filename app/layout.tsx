import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import AppShell from './app-shell';

export const metadata: Metadata = {
  title: 'ISO BAT — Planning Commercial',
  description: 'Suivi des RDV commerciaux ISO BAT',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ISO BAT',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E8A3E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const univers = cookies().get('univers')?.value === 'b2c' ? 'b2c' : 'b2b';
  return (
    <html lang="fr" className={univers === 'b2c' ? 'univers-b2c' : ''}>
      <body>
        <AppShell univers={univers}>{children}</AppShell>
      </body>
    </html>
  );
}
