import { getUserSubscriptions } from '@/lib/sub-actions';
import { getGroupSets, getRuleSets, getProxyGroups, getUpstreamSources } from '@/lib/config-actions';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SubscriptionsClient from './client';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
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
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    // Fetch config data
    const groups = await getGroupSets();
    const rules = await getRuleSets();
    const proxyGroups = await getProxyGroups();
    const sources = await getUpstreamSources();

    // Filter and map default groups
    const defaultGroups = proxyGroups
        .filter(g => g.source !== 'custom')
        .map(g => g.name);

    // Map database fields to frontend fields
    const mappedSubs = subs.map(sub => ({
        token: sub.token,
        name: sub.remark,
        customRules: sub.customRules,
        groupId: sub.groupId,
        ruleId: sub.ruleId,
        selectedSources: sub.selectedSources || [],
    }));

    return (
        <SubscriptionsClient
            initialSubs={mappedSubs}
            username={user.username}
            baseUrl={baseUrl}
            configSets={{ groups, rules }}
            defaultGroups={defaultGroups}
            availableSources={sources}
        />
    );
}
