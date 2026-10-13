import { NextRequest, NextResponse } from 'next/server';
import { listAgentPins, insertAgentPin, setAgentCredentials, usernameTaken } from '@/lib/agent-pins-db';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { generatePassword, slugUsername } from '@/lib/password-gen';

export const dynamic = 'force-dynamic';

async function uniqueUsername(name: string, exceptId?: string): Promise<string> {
  const base = slugUsername(name);
  let candidate = base;
  for (let i = 2; await usernameTaken(candidate, exceptId); i++) candidate = base.replace('@', `${i}@`);
  return candidate;
}

export async function GET() {
  try {
    const data = await listAgentPins();
    const out = data.map((a) => ({
      id: a.id, name: a.name, created_at: a.created_at,
      univers: a.univers === 'b2c' ? 'b2c' : 'b2b',
      username: a.username || null,
      has_password: !!a.pin_hash && !!a.username,
    }));
    return NextResponse.json({ data: out }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Creation d'un agent : identifiant name@isobat.crm + mot de passe genere (affiche UNE seule fois).
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || (me.role !== 'admin' && me.role !== 'gestionnaire')) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  try {
    const row = await insertAgentPin(body.name.trim(), body.univers === 'b2c' ? 'b2c' : 'b2b');
    const username = await uniqueUsername(body.name, row.id);
    const password = generatePassword();
    await setAgentCredentials(row.id, username, await hashPassword(password));
    return NextResponse.json({ data: { ...row, username, password } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Initialisation : donne identifiant + mot de passe a TOUS les agents qui n'en ont pas encore.
export async function PUT(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || (me.role !== 'admin' && me.role !== 'gestionnaire')) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    const agents = await listAgentPins();
    const out: { name: string; univers: string; username: string; password: string }[] = [];
    for (const a of agents) {
      if (a.username && a.pin_hash) continue;
      const username = a.username || await uniqueUsername(a.name, a.id);
      const password = generatePassword();
      await setAgentCredentials(a.id, username, await hashPassword(password));
      out.push({ name: a.name, univers: a.univers === 'b2c' ? 'b2c' : 'b2b', username, password });
    }
    return NextResponse.json({ data: out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
