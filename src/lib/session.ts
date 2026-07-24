import { cookies } from 'next/headers';

export async function setSession(userId: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
  (await cookies()).set('session_id', userId, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function getSession() {
  const sessionId = (await cookies()).get('session_id')?.value;
  return sessionId || null;
}

export async function clearSession() {
  (await cookies()).delete('session_id');
}
