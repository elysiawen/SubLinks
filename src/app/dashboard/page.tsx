import { getUserSubscriptions } from '@/lib/sub-actions';
import { getUpstreamSources } from '@/lib/config-actions';
import { getUserAccessLogs, getUserApiCount24h } from '@/lib/log-actions';
import { requireSession } from '@/lib/require-session';
import { getBaseUrl } from '@/lib/utils';
import OverviewClient from './overview-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const user = await requireSession();
    if (!user) return null;

    const subs = await getUserSubscriptions();
    const sources = await getUpstreamSources();
    const accessLogs = await getUserAccessLogs(3);
    const apiCount24h = await getUserApiCount24h();
    const baseUrl = getBaseUrl();

    const totalSubs = subs.length;
    const enabledSubs = subs.filter(sub => sub.enabled !== false).length;

    const { db } = await import('@/lib/db');
    const userDetails = await db.getUser(user.username);
    const userCreatedAt = userDetails?.createdAt || Date.now();

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
            nickname={user.nickname}
            announcement={announcement}
        />
    );
}
