import { getRuleSets, getProxyGroups } from '@/lib/config-actions';
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
    const proxyGroups = await getProxyGroups();

    return <RulesClient rules={rules} proxyGroups={proxyGroups} />;
}
