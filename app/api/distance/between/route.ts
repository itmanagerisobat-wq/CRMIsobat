import { NextRequest, NextResponse } from 'next/server';
import { routeBetweenPostalCodes } from '@/lib/distance';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const cp1 = req.nextUrl.searchParams.get('cp1');
  const cp2 = req.nextUrl.searchParams.get('cp2');
  if (!cp1 || !cp2) return NextResponse.json({ error: 'cp1 et cp2 requis' }, { status: 400 });

  const result = await routeBetweenPostalCodes(cp1, cp2);
  if (!result) return NextResponse.json({ error: 'Calcul impossible' }, { status: 404 });

  return NextResponse.json(result);
}
