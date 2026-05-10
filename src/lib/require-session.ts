import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * Get the current user session. Returns null if session is invalid.
 * The dashboard/admin layout already handles invalid sessions by rendering SessionRedirect,
 * so pages don't need to redirect themselves.
 */
export async function requireSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;
    const headersList = await import('next/headers').then(mod => mod.headers());
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || undefined;
    return getSession(sessionId, ip);
}
