import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('clients')
    .update({
      type: body.type,
      raison_sociale: body.raison_sociale,
      nom: body.nom,
      prenom: body.prenom,
      adresse: body.adresse,
      responsable: body.responsable,
      fonction_responsable: body.fonction_responsable,
      telephone: body.telephone,
      site_info: body.site_info,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseAdmin();
  const { error } = await db.from('clients').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
