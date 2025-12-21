import { getUserSubscriptions } from '@/lib/sub-actions';
import { getGroupSets, getRuleSets } from '@/lib/config-actions';
import { getSession } from '@/lib/auth';
import DashboardClient from './client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getParsedConfig } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/login');
    }

    const subs = await getUserSubscriptions();
    const groupSets = await getGroupSets();
    const ruleSets = await getRuleSets();

    // Fetch default groups for Rule Builder
    const parsedConfig = await getParsedConfig();
    const defaultGroups = parsedConfig ? parsedConfig['proxy-groups'].map((g: any) => g.name) : [];

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    return (
        <DashboardClient
            initialSubs={subs}
            username={user.username}
            baseUrl={baseUrl}
            configSets={{ groups: groupSets, rules: ruleSets }}
            defaultGroups={defaultGroups}
        />
    );
}
