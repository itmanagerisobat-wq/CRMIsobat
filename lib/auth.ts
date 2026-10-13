// Lightweight shared-password session, no external auth provider needed.
// Two roles share this mechanism: 'admin' (full access) and 'viewer'
// (read + export only). The session cookie's value is "role.hash", where
// hash is an HMAC-style digest tying the role to the app secret so it can't
// be forged without knowing SESSION_SECRET.

export type Role = 'admin' | 'gestionnaire' | 'viewer' | 'relanceur' | 'responsable_b2c' | 'agent';

async function digest(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- password hashing (PBKDF2 via Web Crypto -- works in Node and Edge) ---
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, keyMaterial, 256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, keyMaterial, 256
  );
  const candidateHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return candidateHex === hashHex;
}

// --- session cookie: role.userId.displayNameB64.token ---
export interface SessionUser {
  userId: string;
  role: Role;
  displayName: string;
}

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function sessionToken(role: Role, userId: string, iat?: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || 'change-me';
  // ancien format (sans date d'emission) : conserve pour ne pas deconnecter les sessions existantes
  return iat ? digest(`isobat-planning:${role}:${userId}:${iat}:${secret}`) : digest(`isobat-planning:${role}:${userId}:${secret}`);
}

export async function buildSessionCookie(user: SessionUser): Promise<string> {
  const iat = String(Date.now());
  const token = await sessionToken(user.role, user.userId, iat);
  return `${user.role}.${user.userId}.${b64url(user.displayName)}.${iat}.${token}`;
}

export async function verifySessionCookie(value: string | undefined): Promise<SessionUser | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4 && parts.length !== 5) return null;
  const [role, userId, nameB64] = parts;
  const iat = parts.length === 5 ? parts[3] : undefined;
  const token = parts[parts.length - 1];
  if (role !== 'admin' && role !== 'gestionnaire' && role !== 'viewer' && role !== 'relanceur' && role !== 'responsable_b2c' && role !== 'agent') return null;
  const expected = await sessionToken(role, userId, iat);
  if (token !== expected) return null;
  let displayName = '';
  try { displayName = unb64url(nameB64); } catch { displayName = ''; }
  return { userId, role, displayName };
}

// --- legacy shared-password fallback (kept for backward compatibility) ---
// Both sides are trimmed before comparing: a stray leading/trailing space or
// newline pasted into a Vercel env var (an easy mistake -- invisible in the
// dashboard's masked/obscured value field) would otherwise make the
// password silently never match anything typed by a human, with no way to
// tell from the outside. This costs nothing in security (the secret itself
// is unchanged, only incidental whitespace around it is ignored) but avoids
// an entire class of "it looks right but never works" bugs.
function trimmed(v: string | undefined): string {
  return (v ?? '').trim();
}

export async function checkLegacyPassword(candidate: string): Promise<SessionUser | null> {
  const c = (candidate ?? '').trim();
  if (!c) return null;
  if (process.env.ADMIN_PASSWORD && c === trimmed(process.env.ADMIN_PASSWORD))
    return { userId: 'legacy-admin', role: 'admin', displayName: 'Admin' };
  if (process.env.GESTIONNAIRE_PASSWORD && c === trimmed(process.env.GESTIONNAIRE_PASSWORD))
    return { userId: 'legacy-gestionnaire', role: 'gestionnaire', displayName: 'Gestionnaire' };
  if (process.env.VIEWER_PASSWORD && c === trimmed(process.env.VIEWER_PASSWORD))
    return { userId: 'legacy-viewer', role: 'viewer', displayName: 'Visualisation' };
  // Relanceur: nominative accounts only (name + password) -- no shared password.
  if (process.env.AGENT_PASSWORD && c === trimmed(process.env.AGENT_PASSWORD))
    return { userId: 'legacy-agent', role: 'agent', displayName: 'Agent' };
  if (process.env.TEAM_PASSWORD && c === trimmed(process.env.TEAM_PASSWORD))
    return { userId: 'legacy-admin', role: 'admin', displayName: 'Admin' };
  return null;
}

export const SESSION_COOKIE = 'isobat_session';
export const ROLE_COOKIE = 'isobat_role'; // readable (non httpOnly), for UI only -- never trusted for access control

export async function getSessionUser(req: { cookies: { get: (n: string) => { value: string } | undefined } }): Promise<SessionUser | null> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionCookie(cookie);
}

// --- agent PIN hashing (short 4-digit code, same PBKDF2 mechanism) ---
export const hashPin = hashPassword;
export const verifyPin = verifyPassword;

/** Re-verify a password for a sensitive action (e.g. "delete everything"),
 * against either the nominative account or the legacy shared password. */
export async function verifyCurrentUserPassword(sessionUser: SessionUser, candidate: string, dbUser: { password_hash: string } | null): Promise<boolean> {
  if (sessionUser.userId.startsWith('legacy-')) {
    const legacy = await checkLegacyPassword(candidate);
    return !!legacy && legacy.role === sessionUser.role;
  }
  if (!dbUser) return false;
  return verifyPassword(candidate, dbUser.password_hash);
}
