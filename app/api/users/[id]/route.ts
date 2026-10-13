import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json(); // { password?, display_name?, username?, role? }
  const db = supabaseAdmin();
  const update: Record<string, any> = {};
  if (body.password) update.password_hash = await hashPassword(body.password);
  if (body.display_name) update.display_name = body.display_name.trim();
  if (body.role) update.role = body.role;
  const actor0 = await getSessionUser(req);
  // mot de passe change ou deconnexion demandee -> toutes les sessions de ce compte sont coupees (sauf la sienne)
  if ((body.password || body.logout) && actor0?.userId !== params.id) update.sessions_valid_after = new Date().toISOString();
  if (body.username) {
    const uname = String(body.username).trim();
    const { data: dup } = await db.from('users').select('id').ilike('username', uname).neq('id', params.id).maybeSingle();
    if (dup) return NextResponse.json({ error: 'Cet identifiant est deja utilise par un autre compte.' }, { status: 409 });
    update.username = uname;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Rien a modifier.' }, { status: 400 });

  const { data, error } = await db
    .from('users')
    .update(update)
    .eq('id', params.id)
    .select('id, username, display_name, role')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actor = await getSessionUser(req);
  logActivity(actor, 'update_user', `Compte modifie : ${data?.display_name}${body.password ? ' (mot de passe reinitialise)' : ''}${body.logout ? ' (deconnecte de tous ses appareils)' : ''}`);

  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseAdmin();
  const { data: existing } = await db.from('users').select('display_name').eq('id', params.id).single();
  const { error } = await db.from('users').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actor = await getSessionUser(req);
  logActivity(actor, 'delete_user', `Compte supprime : ${existing?.display_name || params.id}`);

  return NextResponse.json({ ok: true });
}
