import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginContent from './client';

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ deviceCode?: string; callbackUrl?: string }>;
}) {
    const { deviceCode, callbackUrl } = await searchParams;
    const providers = (await db.getOAuthProviders()).filter(p => p.enabled);

    // Check if user already has a valid session
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

    // If already logged in and device flow, redirect directly to confirm page (server-side, no flash)
    if (currentUserId && deviceCode) {
        redirect(`/auth/device-confirm?code=${encodeURIComponent(deviceCode)}`);
    }

    return <LoginContent oauthProviders={providers} />;
}
