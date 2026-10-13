import { NextRequest, NextResponse } from 'next/server';
import { listStatusHistory } from '@/lib/status-history';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('entity_type');
  const id = req.nextUrl.searchParams.get('entity_id');
  if (!type || !id) return NextResponse.json({ error: 'entity_type et entity_id requis' }, { status: 400 });
  try {
    return NextResponse.json({ data: await listStatusHistory(type, id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 200 });
  }
}
