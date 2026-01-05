import { getUserSubscriptions } from '@/lib/sub-actions';
import { getSession } from '@/lib/auth';
import { getUpstreamSources } from '@/lib/config-actions';
import { getUserAccessLogs, getUserApiCount24h } from '@/lib/log-actions';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import OverviewClient from './overview-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/login');
    }

    const subs = await getUserSubscriptions();
    const sources = await getUpstreamSources();
    const accessLogs = await getUserAccessLogs(3);
    const apiCount24h = await getUserApiCount24h();
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    // Calculate statistics
    const totalSubs = subs.length;
    const enabledSubs = subs.filter(sub => sub.enabled !== false).length;

    // Get user creation time from database
    const { db } = await import('@/lib/db');
    const userDetails = await db.getUser(user.username);
    const userCreatedAt = userDetails?.createdAt || Date.now();

    // Get custom background URL from global config
    const globalConfig = await db.getGlobalConfig();
    const customBackgroundUrl = globalConfig.customBackgroundUrl;
    const announcement = globalConfig.announcement;

    return (
        <OverviewClient
            totalSubs={totalSubs}
            enabledSubs={enabledSubs}
            accessLogs={accessLogs}
            upstreamSources={sources}
            apiCount24h={apiCount24h}
            userCreatedAt={userCreatedAt}
            customBackgroundUrl={customBackgroundUrl}
            baseUrl={baseUrl}
            username={user.username}
            announcement={announcement}
        />
    );
}
