import { getParsedConfig } from '@/lib/analysis';
import { getGroupSets } from '@/lib/config-actions';
import AdminGroupsClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminGroupsPage() {
    const config = await getParsedConfig();
    const defaultGroups = config ? (config['proxy-groups'] || []) : [];
    const customSets = await getGroupSets();

    return <AdminGroupsClient defaultGroups={defaultGroups} customSets={customSets} />;
}
