import { NextRequest, NextResponse } from 'next/server';

// Auth logic inlined here (rather than imported from '@/lib/auth') because
// Vercel's Edge Function bundler for middleware can be picky about resolving
// separate module files -- keeping it self-contained avoids that entirely.

const SESSION_COOKIE = 'isobat_session';
type Role = 'admin' | 'gestionnaire' | 'viewer' | 'relanceur' | 'responsable_b2c' | 'agent';

async function digest(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Sessions revoquees : users.sessions_valid_after (migration 42). Cache 15 s par compte (edge).
const revokeCache = new Map<string, { at: number; validAfter: number | null; missing: boolean }>();

async function isRevoked(userId: string, iat: number): Promise<boolean> {
  if (userId.startsWith('legacy-')) return false;
  const isAgent = userId.startsWith('agentpin-');
  const table = isAgent ? 'agent_pins' : 'users';
  const rowId = isAgent ? userId.slice('agentpin-'.length) : userId;
  const now = Date.now();
  let c = revokeCache.get(userId);
  if (!c || now - c.at > 15000) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return false;
    try {
      const r = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(rowId)}&select=sessions_valid_after`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store',
      });
      if (!r.ok) return false; // colonne absente (migration non lancee) ou erreur : on ne bloque pas
      const rows = await r.json();
      c = rows.length === 0
        ? { at: now, validAfter: null, missing: true }
        : { at: now, validAfter: rows[0].sessions_valid_after ? new Date(rows[0].sessions_valid_after).getTime() : null, missing: false };
      revokeCache.set(userId, c);
    } catch { return false; }
  }
  if (c.missing) return true; // compte supprime
  return c.validAfter !== null && iat < c.validAfter;
}

async function verifySessionCookie(value: string | undefined): Promise<Role | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4 && parts.length !== 5) return null;
  const [role, userId] = parts;
  const iat = parts.length === 5 ? parts[3] : undefined;
  const token = parts[parts.length - 1];
  if (role !== 'admin' && role !== 'gestionnaire' && role !== 'viewer' && role !== 'relanceur' && role !== 'responsable_b2c' && role !== 'agent') return null;
  const secret = process.env.SESSION_SECRET || 'change-me';
  const expected = await digest(iat ? `isobat-planning:${role}:${userId}:${iat}:${secret}` : `isobat-planning:${role}:${userId}:${secret}`);
  if (token !== expected) return null;
  if (await isRevoked(userId, iat ? parseInt(iat, 10) || 0 : 0)) return null;
  return role as Role;
}

// Pages/API paths only 'admin' can reach -- gestionnaire is otherwise
// "admin-like" but explicitly excluded from these sensitive areas too.
const ADMIN_ONLY_PREFIXES = ['/backup', '/api/backup', '/api/import', '/clients', '/api/clients'];

// API paths a 'relanceur' is allowed to write to (their one area of full access).
const RELANCEUR_WRITE_PREFIXES = ['/api/relance-log', '/api/rdv/relance', '/api/accords-principe', '/api/rdv-requests'];

function isWriteMethod(method: string) {
  return method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isStaticAsset = /\.[a-zA-Z0-9]+$/.test(pathname) && !pathname.startsWith('/api');

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/agents-list') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    isStaticAsset;

  if (isPublic) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const role = await verifySessionCookie(cookie);

  if (!role) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Interface BtoC : reservee a l'admin, au gestionnaire, a la responsable B2C (et aux agents B2C).
  // Les autres comptes B2B sont ramenes de force en BtoB, meme si le cookie est modifie a la main.
  if ((role === 'viewer' || role === 'relanceur') && !pathname.startsWith('/api') && req.cookies.get('univers')?.value === 'b2c') {
    const res = NextResponse.redirect(req.nextUrl.clone());
    res.cookies.set('univers', 'b2b', { path: '/', maxAge: 31536000 });
    return res;
  }

  if (role === 'agent') {
    if (req.cookies.get('univers')?.value === 'b2c' && (pathname === '/disponibilites' || pathname.startsWith('/disponibilites/'))) {
      return NextResponse.redirect(new URL('/mes-rdv-b2c', req.url));
    }
    const agentAllowed = pathname.startsWith('/disponibilites') || pathname.startsWith('/api/disponibilites') ||
      pathname.startsWith('/carte') || pathname.startsWith('/chat') || pathname.startsWith('/api/chat') ||
      pathname.startsWith('/accords-principe') || pathname.startsWith('/api/accords-principe') ||
      pathname.startsWith('/mes-rdv-b2c') || pathname.startsWith('/api/b2c-rdv') ||
      pathname.startsWith('/api/logout') || pathname.startsWith('/api/parametres') || pathname.startsWith('/api/rdv-requests') ||
      (pathname === '/api/rdv' && req.method === 'GET');
    if (!agentAllowed) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Acces reserve aux agents de prospection' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/disponibilites', req.url));
    }
    // agent can never write outside their booking/request/accords-principe endpoints
    if (isWriteMethod(req.method) && pathname.startsWith('/api') &&
        !pathname.startsWith('/api/disponibilites') && !pathname.startsWith('/api/rdv-requests') &&
        !pathname.startsWith('/api/accords-principe') && !pathname.startsWith('/api/b2c-rdv') && !pathname.startsWith('/api/chat')) {
      return NextResponse.json({ error: 'Acces en lecture seule' }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (role === 'responsable_b2c') {
    // Univers B2C uniquement : on force le cookie d'univers puis on laisse passer
    const univers = req.cookies.get('univers')?.value;
    const isPage = !pathname.startsWith('/api');
    const pageAllowed = ['/planning', '/calendrier', '/relance', '/carte', '/dashboard', '/chat', '/rdv-agents', '/confirmation', '/papiers', '/installation'].some((p) => pathname.startsWith(p));
    const apiReadAllowed = ['/api/parametres', '/api/rdv', '/api/rdv-requests', '/api/rdv-files', '/api/status-history',
      '/api/relance-log', '/api/relance-rappels', '/api/accords-principe', '/api/export/relance', '/api/export/accords-principe',
      '/api/chat', '/api/b2c-rdv', '/api/b2c-installations', '/api/distance', '/api/export', '/api/logout'].some((p) => pathname.startsWith(p));
    if (isPage) {
      if (!pageAllowed) return NextResponse.redirect(new URL('/relance', req.url));
      if (univers !== 'b2c') {
        const res = NextResponse.redirect(req.nextUrl.clone());
        res.cookies.set('univers', 'b2c', { path: '/', maxAge: 31536000 });
        return res;
      }
      return NextResponse.next();
    }
    if (!apiReadAllowed) return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    if (isWriteMethod(req.method) && !pathname.startsWith('/api/logout')) {
      const ok = RELANCEUR_WRITE_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.startsWith('/api/chat') || pathname.startsWith('/api/b2c-rdv') || pathname.startsWith('/api/b2c-installations') || pathname.startsWith('/api/rdv-files') || pathname === '/api/rdv' || /^\/api\/rdv\/[^/]+$/.test(pathname);
      if (!ok) return NextResponse.json({ error: 'Acces en lecture seule' }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (role === 'gestionnaire') {
    const isAdminOnlyArea = ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
    if (isAdminOnlyArea) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Acces reserve aux administrateurs' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/carte', req.url));
    }
    // Only Admin can manage user accounts (roles, create, delete)
    if (pathname.startsWith('/api/users') && isWriteMethod(req.method)) {
      return NextResponse.json({ error: 'Acces reserve aux administrateurs' }, { status: 403 });
    }
    // full read+write access everywhere else, like admin (including Parametres)
    return NextResponse.next();
  }

  if (role === 'viewer' || role === 'relanceur') {
    const isAdminOnlyArea = ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
    if (isAdminOnlyArea) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Acces reserve aux administrateurs' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/carte', req.url));
    }

    // Relanceur: no access at all to Parametres (page); the data API stays readable for the Relance page.
    if (role === 'relanceur' && pathname.startsWith('/parametres')) {
      return NextResponse.redirect(new URL('/relance', req.url));
    }

    if (isWriteMethod(req.method) && pathname.startsWith('/api') &&
        !pathname.startsWith('/api/login') && !pathname.startsWith('/api/logout') && !pathname.startsWith('/api/chat')) {
      let relanceurAllowed = role === 'relanceur' && RELANCEUR_WRITE_PREFIXES.some((p) => pathname.startsWith(p));
      // Document status/note (Relance page) = the only fields a relanceur may PATCH on a RDV.
      if (!relanceurAllowed && role === 'relanceur' && req.method === 'PATCH' && /^\/api\/rdv\/[^/]+$/.test(pathname)) {
        try {
          const body = await req.clone().json();
          const keys = Object.keys(body || {});
          relanceurAllowed = keys.length > 0 && keys.every((k) => k === 'document_statut' || k === 'document_note');
        } catch { /* not allowed */ }
      }
      if (!relanceurAllowed) {
        return NextResponse.json({ error: 'Acces en lecture seule' }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
