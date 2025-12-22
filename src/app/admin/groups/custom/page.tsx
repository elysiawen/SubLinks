import { db } from '@/lib/db';
import CustomGroupsClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomGroupsPage() {
    const customGroups = await db.getCustomGroups();
    const proxies = await db.getProxies();

    return <CustomGroupsClient customGroups={customGroups} initialProxies={proxies} />;
}
