'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError("L'identifiant est requis."); return; }
    setLoading(true);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setLoading(false);
    const loginJson = await res.json().catch(() => ({}));
    if (!res.ok) { setError(loginJson.error || 'Identifiant ou mot de passe incorrect.'); return; }
    const defaultDest = loginJson.role === 'agent' ? '/disponibilites' : '/carte';
    router.push(params.get('next') || defaultDest);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-forest relative overflow-hidden">
      {/* large white watermark logo on the green background, behind the card */}
      <div className="pointer-events-none select-none absolute -top-16 -left-16 opacity-[0.14]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="" width={320} height={320} />
      </div>
      <div className="pointer-events-none select-none absolute -bottom-20 -right-16 opacity-[0.14]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="" width={320} height={320} />
      </div>

      <form
        onSubmit={onSubmit}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-8"
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ISO BAT" width={64} height={64} />
          </div>
          <div className="text-forest font-bold text-xl tracking-wide">ISO BAT</div>
          <div className="text-ink/60 text-sm mt-1">Planning Commercial</div>
        </div>

        <label className="block text-sm font-medium text-ink mb-1">Identifiant</label>
        <input
          type="text"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex: prenom@isobat.crm"
          className="w-full border border-black/10 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-gold text-sm"
        />
        <label className="block text-sm font-medium text-ink mb-1">Mot de passe</label>
        <input
          type="password"
          autoCapitalize="none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-black/10 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-gold"
        />

        {error && <p className="text-statut-annule text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-forest hover:bg-forest-dark text-white font-medium rounded-md py-2 transition-colors disabled:opacity-60"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
