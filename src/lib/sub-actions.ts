'use server'

import { db } from '@/lib/db';
import { generateToken } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SubData } from './database/interface';

// Helper to check user
async function getCurrentSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;
    return await getSession(sessionId);
}

export async function createSubscription(remark: string, customRules: string, groupId: string = 'default', ruleId: string = 'default', selectedSources: string[] = []) {
    const session = await getCurrentSession();
    if (!session) return { error: 'Unauthorized' };

    const token = generateToken();
    const subData: SubData = {
        username: session.username,
        remark: remark || '未命名订阅',
        customRules: customRules || '',
        groupId,
        ruleId,
        selectedSources,
        enabled: true,
        createdAt: Date.now()
    };

    await db.createSubscription(token, session.username, subData);

    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteSubscription(token: string) {
    const session = await getCurrentSession();
    if (!session) return { error: 'Unauthorized' };

    // Verify ownership
    const isOwner = await db.isSubscriptionOwner(session.username, token);
    if (!isOwner) return { error: 'Forbidden' };

    await db.deleteSubscription(token, session.username);

    revalidatePath('/dashboard');
    return { success: true };
}

export async function updateSubscription(token: string, remark: string, customRules: string, groupId: string = 'default', ruleId: string = 'default', selectedSources: string[] = []) {
    const session = await getCurrentSession();
    if (!session) return { error: 'Unauthorized' };

    // Verify ownership
    const isOwner = await db.isSubscriptionOwner(session.username, token);
    if (!isOwner) return { error: 'Forbidden' };

    const subData = await db.getSubscription(token);
    if (!subData) return { error: 'Not found' };

    subData.remark = remark;
    subData.customRules = customRules;
    subData.groupId = groupId;
    subData.ruleId = ruleId;
    subData.selectedSources = selectedSources;

    await db.updateSubscription(token, subData);

    // Invalidate subscription cache
    await db.deleteCache(`cache:subscription:${token}`);

    revalidatePath('/dashboard');
    return { success: true };
}

export async function getUserSubscriptions() {
    const session = await getCurrentSession();
    if (!session) return [];

    const subs = await db.getUserSubscriptions(session.username);
    return subs.sort((a, b) => b.createdAt - a.createdAt);
}

