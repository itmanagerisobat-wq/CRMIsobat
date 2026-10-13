import { NextRequest, NextResponse } from 'next/server';
import { deleteAgentPin, setAgentUnivers, setAgentCredentials, renameAgent, revokeAgentSessions, getAgentPinById, usernameTaken } from '@/lib/agent-pins-db';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { generatePassword } from '@/lib/password-gen';

export const dynamic = 'force-dynamic';

async function guard(req: NextRequest) {
  const me = await getSessionUser(req);
  return me && (me.role === 'admin' || me.role === 'gestionnaire');
}

// { univers } | { regenerate: true } (nouveau mot de passe + deconnexion) | { logout: true } | { name, username }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.univers) {
      await setAgentUnivers(params.id, body.univers === 'b2c' ? 'b2c' : 'b2b');
      return NextResponse.json({ ok: true });
    }
    if (body.regenerate) {
      const password = generatePassword();
      await setAgentCredentials(params.id, null, await hashPassword(password));
      await revokeAgentSessions(params.id);
      const a = await getAgentPinById(params.id);
      return NextResponse.json({ ok: true, username: a?.username, password });
    }
    if (body.logout) {
      await revokeAgentSessions(params.id);
      return NextResponse.json({ ok: true });
    }
    if (body.name && body.username) {
      const username = String(body.username).trim();
      if (await usernameTaken(username, params.id)) return NextResponse.json({ error: 'Cet identifiant est deja utilise.' }, { status: 409 });
      await renameAgent(params.id, String(body.name).trim(), username);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Rien a modifier.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    await deleteAgentPin(params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
