import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';

/**
 * Verify the current request is from an authenticated admin user.
 * Throws on failure — call at the top of every admin server action.
 */
export async function requireAdmin() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) throw new Error('Unauthorized');

    const session = await getSession(sessionId);
    if (!session || session.role !== 'admin') throw new Error('Unauthorized');

    return session;
}
