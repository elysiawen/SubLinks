'use server'

import { redis } from '@/lib/redis';
import { generateToken } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

interface SubData {
    token: string;
    username: string;
    name: string;
    customRules: string;
    groupId?: string;
    ruleId?: string;
    enabled: boolean;
    createdAt: number;
}

// Helper to check user
async function getCurrentSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;
    return await getSession(sessionId);
}

export async function createSubscription(name: string, customRules: string, groupId: string = 'default', ruleId: string = 'default') {
    const session = await getCurrentSession();
    if (!session) return { error: 'Unauthorized' };

    const token = generateToken();
    const subData: SubData = {
        token,
        username: session.username,
        name: name || '未命名订阅',
        customRules: customRules || '',
        groupId,
        ruleId,
        enabled: true,
        createdAt: Date.now()
    };

    await redis.set(`sub:${token}`, JSON.stringify(subData));
    await redis.sadd(`user:${session.username}:subs`, token);

    // Immediate Upstream Cache Refresh
    const { refreshUpstreamCache } = await import('@/lib/analysis');
    await refreshUpstreamCache();

    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteSubscription(token: string) {
    const session = await getCurrentSession();
    if (!session) return { error: 'Unauthorized' };

    // Verify ownership
    const isOwner = await redis.sismember(`user:${session.username}:subs`, token);
    if (!isOwner) return { error: 'Forbidden' };

    await redis.del(`sub:${token}`);
    await redis.srem(`user:${session.username}:subs`, token);

    revalidatePath('/dashboard');
    return { success: true };
}

export async function updateSubscription(token: string, name: string, customRules: string, groupId: string = 'default', ruleId: string = 'default') {
    const session = await getCurrentSession();
    if (!session) return { error: 'Unauthorized' };

    // Verify ownership
    const isOwner = await redis.sismember(`user:${session.username}:subs`, token);
    if (!isOwner) return { error: 'Forbidden' };

    const subDataStr = await redis.get(`sub:${token}`);
    if (!subDataStr) return { error: 'Not found' };

    const subData = JSON.parse(subDataStr) as SubData;
    subData.name = name;
    subData.customRules = customRules;
    subData.groupId = groupId;
    subData.ruleId = ruleId;

    await redis.set(`sub:${token}`, JSON.stringify(subData));

    // Immediate Upstream Cache Refresh
    const { refreshUpstreamCache } = await import('@/lib/analysis');
    await refreshUpstreamCache();

    revalidatePath('/dashboard');
    return { success: true };
}

export async function getUserSubscriptions() {
    const session = await getCurrentSession();
    if (!session) return [];

    const tokens = await redis.smembers(`user:${session.username}:subs`);
    if (!tokens || tokens.length === 0) return [];

    const subs = await Promise.all(tokens.map(async (token) => {
        const data = await redis.get(`sub:${token}`);
        return data ? JSON.parse(data) : null;
    }));

    return subs.filter(s => s !== null).sort((a, b) => b.createdAt - a.createdAt);
}
