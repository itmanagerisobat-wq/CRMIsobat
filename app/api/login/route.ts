import { getAgentByUsername } from '@/lib/agent-pins-db';
import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE, ROLE_COOKIE, buildSessionCookie, verifyPassword, verifyPin, hashPin, checkLegacyPassword, SessionUser,
} from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getAgentPinById, setAgentPinHash } from '@/lib/agent-pins-db';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  let sessionUser: SessionUser | null = null;
  let agentUnivers: string | null = null;

  if (!sessionUser && username && username.trim()) {
    // nominative account lookup
    const db = supabaseAdmin();
    const { data: user } = await db
      .from('users')
      .select('*')
      .ilike('username', username.trim())
      .maybeSingle();

    if (!user) {
      // agent de prospection : identifiant name@isobat.crm + mot de passe personnel
      try {
        const agent = await getAgentByUsername(username);
        if (agent && agent.pin_hash && await verifyPassword(password ?? '', agent.pin_hash)) {
          sessionUser = { userId: `agentpin-${agent.id}`, role: 'agent', displayName: agent.name };
          agentUnivers = (agent as any).univers || 'b2b';
        }
      } catch (e: any) {
        return NextResponse.json({ error: `Connexion a la base echouee : ${e.message}` }, { status: 500 });
      }
    }

    if (user) {
      const ok = await verifyPassword(password ?? '', user.password_hash);
      if (ok) {
        sessionUser = { userId: user.id, role: user.role, displayName: user.display_name };
        db.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id).then(() => {});
      }
    }
  }

  // fall back to the legacy shared passwords (works with or without a username typed)
  if (!sessionUser) {
    sessionUser = await checkLegacyPassword(password ?? '');
  }

  if (!sessionUser) {
    return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 });
  }

  const cookieValue = await buildSessionCookie(sessionUser);
  const res = NextResponse.json({ ok: true, role: sessionUser.role, displayName: sessionUser.displayName });
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  res.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  res.cookies.set(ROLE_COOKIE, JSON.stringify({ role: sessionUser.role, displayName: sessionUser.displayName }), {
    httpOnly: false, // readable client-side, for UI only -- never used for access control
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  // Interface BtoB / BtoC : agents -> leur univers ; responsable B2C -> b2c ; comptes B2B (relanceur, visu) -> b2b.
  // Admin / gestionnaire gardent leur dernier choix.
  const forcedUnivers = sessionUser.role === 'agent' ? (agentUnivers === 'b2c' ? 'b2c' : 'b2b')
    : sessionUser.role === 'responsable_b2c' ? 'b2c'
    : (sessionUser.role === 'relanceur' || sessionUser.role === 'viewer') ? 'b2b' : null;
  if (forcedUnivers) res.cookies.set('univers', forcedUnivers, { path: '/', maxAge: 31536000 });

  logActivity(sessionUser, 'login');

  return res;
}
