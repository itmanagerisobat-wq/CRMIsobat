import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionCookie } from '@/lib/auth';

export default async function Home() {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookie(cookie);
  if (session?.role === 'agent') redirect('/disponibilites');
  redirect('/carte');
}
