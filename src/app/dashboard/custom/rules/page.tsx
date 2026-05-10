import { getRuleSets, getProxyGroups, getGroupSets } from '@/lib/config-actions';
import { requireSession } from '@/lib/require-session';
import RulesClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomRulesPage() {
    const user = await requireSession();
    if (!user) return null;

    const rules = await getRuleSets();
    const rawProxyGroups = await getProxyGroups();
    const customGroups = await getGroupSets();

    const proxyGroups = [
        ...rawProxyGroups,
        ...customGroups.map(g => ({
            name: g.name,
            type: 'custom',
            source: '自定义组',
            id: g.id
        }))
    ];

    return <RulesClient rules={rules} proxyGroups={proxyGroups} />;
}
