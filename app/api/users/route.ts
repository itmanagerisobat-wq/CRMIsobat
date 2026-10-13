import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('users')
    .select('id, username, display_name, role, created_at, last_login')
    .order('display_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json(); // { username, password, display_name, role }
  if (!body.username || !body.password || !body.display_name || !body.role) {
    return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 });
  }
  const db = supabaseAdmin();
  const password_hash = await hashPassword(body.password);
  const { data, error } = await db
    .from('users')
    .insert({
      username: body.username.trim(),
      password_hash,
      display_name: body.display_name.trim(),
      role: body.role,
    })
    .select('id, username, display_name, role, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actor = await getSessionUser(req);
  logActivity(actor, 'create_user', `Compte cree : ${body.display_name} (${body.role})`);

  return NextResponse.json({ data });
}
