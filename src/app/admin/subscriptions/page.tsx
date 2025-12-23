import AdminSubsClient from './client';
import { getAdminSubscriptions } from './actions';
import { getGroupSets, getRuleSets } from '@/lib/config-actions';
import { db } from '@/lib/db';
import { getParsedConfig } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage() {
    const subs = await getAdminSubscriptions();
    const groupSets = await getGroupSets();
    const ruleSets = await getRuleSets();

    // Fetch default groups 
    const allGroups = await db.getProxyGroups();
    const defaultGroups = allGroups
        .filter(g => g.source !== 'custom')
        .map(g => g.name);

    const availableSources = await db.getUpstreamSources();

    return (
        <div className="space-y-6">
            <AdminSubsClient
                initialSubs={subs}
                configSets={{ groups: groupSets, rules: ruleSets }}
                defaultGroups={defaultGroups}
                availableSources={availableSources}
            />
        </div>
    );
}
