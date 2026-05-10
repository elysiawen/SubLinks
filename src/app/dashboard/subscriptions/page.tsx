import { getUserSubscriptions } from '@/lib/sub-actions';
import { getGroupSets, getRuleSets, getProxyGroups, getUpstreamSources, getProxySourceMap } from '@/lib/config-actions';
import { requireSession } from '@/lib/require-session';
import SubscriptionsClient from './client';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
    const user = await requireSession();
    if (!user) return null;

    const subs = await getUserSubscriptions();
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    const groups = await getGroupSets();
    const rules = await getRuleSets();
    const proxyGroups = await getProxyGroups();
    const sources = await getUpstreamSources();
    const proxySourceMap = await getProxySourceMap();

    const defaultGroups = proxyGroups
        .filter(g => g.source !== 'custom')
        .map(g => ({ name: g.name, source: g.source }));

    const mappedSubs = subs.map(sub => ({
        token: sub.token,
        name: sub.remark,
        customRules: sub.customRules,
        groupId: sub.groupId,
        ruleId: sub.ruleId,
        selectedSources: sub.selectedSources || [],
        enabled: sub.enabled,
    }));

    return (
        <SubscriptionsClient
            initialSubs={mappedSubs}
            username={user.username}
            baseUrl={baseUrl}
            configSets={{ groups, rules }}
            defaultGroups={defaultGroups}
            availableSources={sources}
            proxySourceMap={proxySourceMap}
        />
    );
}
