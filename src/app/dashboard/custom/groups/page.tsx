import { getGroupSets } from '@/lib/config-actions';
import { requireSession } from '@/lib/require-session';
import { db } from '@/lib/db';
import GroupsClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomGroupsPage() {
    const user = await requireSession();
    if (!user) return null;

    const groups = await getGroupSets();
    const proxies = await db.getProxies();

    return <GroupsClient groups={groups} proxies={proxies} />;
}
