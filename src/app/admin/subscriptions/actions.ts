'use server'

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { generateToken } from '@/lib/utils';
import { SubData } from '@/lib/database/interface';

// Helper to check admin
async function getAdminSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;

    const session = await getSession(sessionId);
    if (!session || session.role !== 'admin') return null;

    return session;
}

export async function getAdminSubscriptions(page: number = 1, limit: number = 10, search?: string) {
    const session = await getAdminSession();
    if (!session) return { data: [], total: 0 };

    return await db.getAllSubscriptions(page, limit, search);
}

export async function createAdminSubscription(
    username: string,
    data: {
        remark: string,
        customRules?: string,
        groupId?: string,
        ruleId?: string,
        selectedSources?: string[]
    }
) {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    if (!username || username.trim() === '') {
        return { error: '请选择用户' };
    }

    // Check user exists
    const user = await db.getUser(username);
    if (!user) {
        return { error: '用户不存在' };
    }

    const token = generateToken();
    const now = Date.now();

    const newSub: SubData = {
        username: username.trim(),
        remark: data.remark || '未命名订阅',
        enabled: true,
        createdAt: now,
        customRules: data.customRules || '',
        groupId: data.groupId || 'default',
        ruleId: data.ruleId || 'default',
        selectedSources: data.selectedSources?.filter(s => s.trim() !== '') || [],
        autoDisabled: false
    };

    // Ensure at least one source is selected
    if (!newSub.selectedSources || newSub.selectedSources.length === 0) {
        return { error: '请至少选择一个上游源' };
    }

    await db.createSubscription(token, username.trim(), newSub);

    revalidatePath('/admin/subscriptions');
    return { success: true, token };
}

export async function deleteAdminSubscription(token: string) {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    // Get sub to find owner
    const sub = await db.getSubscription(token);
    if (!sub) return { error: 'Not found' };

    await db.deleteSubscription(token, sub.username);

    // Invalidate cache
    await db.deleteCache(`cache:subscription:${token}`);

    revalidatePath('/admin/subscriptions');
    return { success: true };
}

export async function updateAdminSubscription(
    token: string,
    data: {
        remark: string,
        enabled: boolean,
        customRules?: string,
        groupId?: string,
        ruleId?: string,
        selectedSources?: string[]
    }
) {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    const sub = await db.getSubscription(token);
    if (!sub) return { error: 'Not found' };

    const updatedSub: SubData = {
        ...sub,
        remark: data.remark,
        enabled: data.enabled,
        customRules: data.customRules ?? sub.customRules,
        groupId: data.groupId ?? sub.groupId,
        ruleId: data.ruleId ?? sub.ruleId,
        selectedSources: data.selectedSources ?? sub.selectedSources,
        autoDisabled: false // Reset auto-disable flag on manual admin update
    };

    // Filter out any empty strings from selectedSources
    if (updatedSub.selectedSources) {
        updatedSub.selectedSources = updatedSub.selectedSources.filter(s => s.trim() !== '');
    }

    // Ensure at least one source is selected
    if (!updatedSub.selectedSources || updatedSub.selectedSources.length === 0) {
        return { error: 'At least one upstream source must be selected' };
    }

    await db.updateSubscription(token, updatedSub);

    // Invalidate cache
    await db.deleteCache(`cache:subscription:${token}`);

    revalidatePath('/admin/subscriptions');
    return { success: true };
}

export async function refreshSubscriptionCache(token: string) {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    // Invalidate cache
    await db.deleteCache(`cache:subscription:${token}`);

    return { success: true };
}

export async function rebuildSubscriptionCache(token: string) {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    try {
        // 1. Clear cache
        await db.deleteCache(`cache:subscription:${token}`);

        // 2. Precache (Fetch)
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/s/${token}`, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'SubLinks-Precache/1.0',
                'x-internal-system-precache': 'true',
                'x-force-refresh': 'true'
            }
        });

        if (!response.ok) {
            return { error: `Failed to rebuild: Server returned ${response.status}` };
        }

        return { success: true, message: '已重建订阅缓存' };
    } catch (e) {
        console.error('Rebuild error:', e);
        return { error: 'Failed to rebuild cache' };
    }
}

export async function refreshAllSubscriptionCaches() {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    // Clear all subscription caches
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/subscriptions');
    return { success: true };
}

export async function precacheAllSubscriptions(force: boolean = false) {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    try {
        // Get all subscriptions
        // Get all subscriptions - for precache we want all, so use large limit
        const { data: allSubs } = await db.getAllSubscriptions(1, 10000);

        if (allSubs.length === 0) {
            return { error: 'No subscriptions found' };
        }

        // If forced, clear all caches first (much faster than individual deletion)
        if (force) {
            await db.clearAllSubscriptionCaches();
        }

        // Trigger cache generation for each subscription by making a request
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
        const results = await Promise.allSettled(
            allSubs.map(async (sub) => {
                try {
                    // Note: If force is true, we already cleared global cache above.
                    // If force is false, we just visit. If cache exists, it returns 200 (Hit). If not, it builds (Miss).

                    const response = await fetch(`${baseUrl}/api/s/${sub.token}`, {
                        method: 'HEAD', // Use HEAD to avoid downloading full content
                        headers: {
                            'User-Agent': 'SubLinks-Precache/1.0',
                            'x-internal-system-precache': 'true',
                            // Add a custom header just in case we need it later, though global clear handles it
                            ...(force ? { 'x-force-refresh': 'true' } : {})
                        }
                    });
                    return { token: sub.token, success: response.ok };
                } catch (err) {
                    return { token: sub.token, success: false, error: err };
                }
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        return {
            success: true,
            message: force
                ? `已重建 ${successful}/${allSubs.length} 个订阅缓存`
                : `已预热 ${successful}/${allSubs.length} 个订阅缓存`,
            total: allSubs.length,
            cached: successful
        };
    } catch (error) {
        console.error('Precache error:', error);
        return { error: 'Failed to precache subscriptions' };
    }
}
