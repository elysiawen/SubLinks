import { db } from '@/lib/db';
import { getAllGroupSetsAdmin } from '@/lib/config-actions';
import CustomGroupsClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomGroupsPage() {
    const customGroups = await getAllGroupSetsAdmin();
    const proxies = await db.getProxies();

    return <CustomGroupsClient customGroups={customGroups} initialProxies={proxies} />;
}
