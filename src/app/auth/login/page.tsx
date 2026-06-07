import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import LoginContent from './client';

export default async function LoginPage() {
    const providers = (await db.getOAuthProviders()).filter(p => p.enabled);

    // Check if user already has a valid session (for device flow auto-authorize)
    let currentUserId: string | undefined;
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('auth_session')?.value;
        if (sessionId) {
            const session = await getSession(sessionId);
            if (session) {
                currentUserId = session.userId;
            }
        }
    } catch {
        // Not logged in, that's fine
    }

    return <LoginContent oauthProviders={providers} currentUserId={currentUserId} />;
}
