import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseAdmin();
  const { data: batch } = await db.from('import_batches').select('*').eq('id', params.id).single();

  const { error: delRdvError, count } = await db
    .from('rdv')
    .delete({ count: 'exact' })
    .eq('import_batch_id', params.id);
  if (delRdvError) return NextResponse.json({ error: delRdvError.message }, { status: 500 });

  const { error: delBatchError } = await db.from('import_batches').delete().eq('id', params.id);
  if (delBatchError) return NextResponse.json({ error: delBatchError.message }, { status: 500 });

  const actor = await getSessionUser(req);
  logActivity(actor, 'delete_rdv', `Import supprime : ${batch?.filename || params.id} (${count || 0} RDV)`);

  return NextResponse.json({ ok: true, deleted: count || 0 });
}
