import { getUserSubscriptions } from '@/lib/sub-actions';
import { getGroupSets, getRuleSets } from '@/lib/config-actions';
import { getSession } from '@/lib/auth';
import DashboardClient from './client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';


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

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    // Map database fields to frontend fields
    const mappedSubs = subs.map(sub => ({
        token: sub.token,
        name: sub.remark, // Map remark to name
        customRules: sub.customRules,
        groupId: sub.groupId,
        ruleId: sub.ruleId,
        selectedSources: sub.selectedSources || [],
    }));

    return (
        <DashboardClient
            initialSubs={mappedSubs}
            username={user.username}
            baseUrl={baseUrl}
        />
    );
}
