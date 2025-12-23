import { getUserSubscriptions } from '@/lib/sub-actions';
import { getGroupSets, getRuleSets } from '@/lib/config-actions';
import { getSession } from '@/lib/auth';
import DashboardClient from './client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
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
    // We fetch all groups that are NOT custom sets (source != 'custom')
    // This includes 'upstream' and any other source names
    const allGroups = await db.getProxyGroups();
    const defaultGroups = allGroups
        .filter(g => g.source !== 'custom') // Filter out custom sets if stored in same table, though they shouldn't be
        .map(g => g.name);

    // Get available upstream sources
    const availableSources = await db.getUpstreamSources();

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
            configSets={{ groups: groupSets, rules: ruleSets }}
            defaultGroups={defaultGroups}
            availableSources={availableSources}
        />
    );
}
