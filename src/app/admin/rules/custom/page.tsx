import { getAllRuleSetsAdmin, getProxyGroups, getAllGroupSetsAdmin } from '@/lib/config-actions';
import CustomRulesClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomRulesPage() {
    const customRules = await getAllRuleSetsAdmin();
    const rawProxyGroups = await getProxyGroups();
    const customGroups = await getAllGroupSetsAdmin();

    // Merge custom groups into proxy groups list
    const proxyGroups = [
        ...rawProxyGroups,
        ...customGroups.map(g => ({
            name: g.name,
            type: 'custom',
            source: '自定义组',
            id: g.id // Optional
        }))
    ];

    return <CustomRulesClient customRules={customRules} proxyGroups={proxyGroups} />;
}
