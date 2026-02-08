import { getRuleSets, getProxyGroups, getGroupSets } from '@/lib/config-actions';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RulesClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomRulesPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/login');
    }

    const rules = await getRuleSets();
    const rawProxyGroups = await getProxyGroups();
    const customGroups = await getGroupSets();

    // Merge custom groups into proxy groups list
    const proxyGroups = [
        ...rawProxyGroups,
        ...customGroups.map(g => ({
            name: g.name,
            type: 'custom',
            source: '自定义组',
            id: g.id // Optional but good for key
        }))
    ];

    return <RulesClient rules={rules} proxyGroups={proxyGroups} />;
}
