import { NextRequest, NextResponse } from 'next/server';
import { distanceParisForPostalCode } from '@/lib/distance';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp');
  if (!cp) return NextResponse.json({ error: 'code postal requis' }, { status: 400 });

  const result = await distanceParisForPostalCode(cp);
  if (!result) return NextResponse.json({ error: 'Code postal introuvable' }, { status: 404 });

  return NextResponse.json(result);
}
