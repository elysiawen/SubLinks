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

export async function getAdminSubscriptions() {
    const session = await getAdminSession();
    if (!session) return [];

    return await db.getAllSubscriptions();
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
        selectedSources: data.selectedSources ?? sub.selectedSources
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

export async function refreshAllSubscriptionCaches() {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    // Clear all subscription caches
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/subscriptions');
    return { success: true };
}

export async function precacheAllSubscriptions() {
    const session = await getAdminSession();
    if (!session) return { error: 'Unauthorized' };

    try {
        // Get all subscriptions
        const allSubs = await db.getAllSubscriptions();

        if (allSubs.length === 0) {
            return { error: 'No subscriptions found' };
        }

        // Trigger cache generation for each subscription by making a request
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const results = await Promise.allSettled(
            allSubs.map(async (sub) => {
                try {
                    const response = await fetch(`${baseUrl}/api/s/${sub.token}`, {
                        method: 'HEAD', // Use HEAD to avoid downloading full content
                        headers: {
                            'User-Agent': 'SubLinks-Precache/1.0'
                        }
                    });
                    return { token: sub.token, success: response.ok };
                } catch (err) {
                    return { token: sub.token, success: false, error: err };
                }
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;

        return {
            success: true,
            message: `已缓存 ${successful}/${allSubs.length} 个订阅`,
            total: allSubs.length,
            cached: successful
        };
    } catch (error) {
        console.error('Precache error:', error);
        return { error: 'Failed to precache subscriptions' };
    }
}
