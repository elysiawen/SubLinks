'use server'

import { redis } from '@/lib/redis';
import { generateToken } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Helper to check user
async function getCurrentUser() {
    const sessionId = (await cookies()).get('auth_session')?.value;
    if (!sessionId) return null;
    const session = await getSession(sessionId);
    if (!session) return null;
    return session.username;
}

export async function createSubscription(name: string, customRules: string) {
    const username = await getCurrentUser();
    if (!username) return { error: 'Unauthorized' };

    const token = generateToken();
    const subData = {
        token,
        username,
        name: name || 'Default',
        customRules: customRules || '',
        enabled: true,
        createdAt: Date.now()
    };

    // 1. Save Sub Details
    await redis.set(`sub:${token}`, JSON.stringify(subData));

    // 2. Link to User
    await redis.sadd(`user:${username}:subs`, token);

    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteSubscription(token: string) {
    const username = await getCurrentUser();
    if (!username) return { error: 'Unauthorized' };

    // Verify ownership
    const isOwner = await redis.sismember(`user:${username}:subs`, token);
    if (!isOwner) return { error: 'Forbidden' };

    await redis.del(`sub:${token}`);
    await redis.srem(`user:${username}:subs`, token);

    revalidatePath('/dashboard');
    return { success: true };
}

export async function updateSubscription(token: string, name: string, rules: string) {
    const username = await getCurrentUser();
    if (!username) return { error: 'Unauthorized' };

    const isOwner = await redis.sismember(`user:${username}:subs`, token);
    if (!isOwner) return { error: 'Forbidden' };

    const dataStr = await redis.get(`sub:${token}`);
    if (dataStr) {
        const data = JSON.parse(dataStr);
        data.name = name;
        data.customRules = rules;
        await redis.set(`sub:${token}`, JSON.stringify(data));
        revalidatePath('/dashboard');
        return { success: true };
    }
    return { error: 'Not found' };
}

export async function getUserSubscriptions() {
    const username = await getCurrentUser();
    if (!username) return [];

    const tokens = await redis.smembers(`user:${username}:subs`);
    if (!tokens || tokens.length === 0) return [];

    const subs = await Promise.all(tokens.map(async (token) => {
        const data = await redis.get(`sub:${token}`);
        return data ? JSON.parse(data) : null;
    }));

    return subs.filter(s => s !== null).sort((a, b) => b.createdAt - a.createdAt);
}
