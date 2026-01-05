import { getGroupSets } from '@/lib/config-actions';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import GroupsClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomGroupsPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/login');
    }

    const groups = await getGroupSets();
    const proxies = await db.getProxies();

    return <GroupsClient groups={groups} proxies={proxies} />;
}
