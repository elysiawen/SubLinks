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

    // Check subscription limit (all users including admins)
    const user = await db.getUser(session.username);
    const config = await db.getGlobalConfig();
    // Use user's custom limit if set, otherwise use global limit
    const maxSubs = user?.maxSubscriptions ?? config.maxUserSubscriptions ?? 1;

    if (maxSubs > 0) {
        const userSubs = await db.getUserSubscriptions(session.username);
        if (userSubs.length >= maxSubs) {
            return { error: `超过最大订阅数量限制 (${maxSubs}条)` };
        }
    }

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

    // Filter out empty strings
    subData.selectedSources = subData.selectedSources?.filter(s => s.trim() !== '') || [];

    if (!subData.selectedSources || subData.selectedSources.length === 0) {
        return { error: '至少选择一个上游源' };
    }

    // Validate that selected sources are enabled
    const allSources = await db.getUpstreamSources();
    const enabledSourceNames = new Set(
        allSources.filter(s => s.enabled !== false).map(s => s.name)
    );

    const invalidSources = subData.selectedSources.filter(s => !enabledSourceNames.has(s));
    if (invalidSources.length > 0) {
        return { error: `无法创建订阅: 所选源 (${invalidSources.join(', ')}) 已被禁用或不存在` };
    }

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
    subData.ruleId = ruleId;

    // Filter and Validate selectedSources
    const filteredSources = selectedSources.filter(s => s.trim() !== '');
    if (filteredSources.length === 0) {
        return { error: '至少选择一个上游源' };
    }
    subData.selectedSources = filteredSources;

    // Validate that selected sources are enabled
    const allSources = await db.getUpstreamSources();
    const enabledSourceNames = new Set(
        allSources.filter(s => s.enabled !== false).map(s => s.name)
    );

    const invalidSources = subData.selectedSources.filter(s => !enabledSourceNames.has(s));
    // Ideally we should prevent saving, but user might be editing an already disabled sub? 
    // Actually user dashboard is for ACTIVE management. If they pick a disabled source, we should tell them.
    if (invalidSources.length > 0) {
        return { error: `无法更新订阅: 所选源 (${invalidSources.join(', ')}) 已被禁用或不存在` };
    }

    // Reset auto-disabled flag if user manually updates subscription
    subData.autoDisabled = false;

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


export async function toggleSubscriptionEnabled(token: string, enabled: boolean) {
    const session = await getCurrentSession();
    if (!session) return { error: 'Unauthorized' };

    // Verify ownership
    const isOwner = await db.isSubscriptionOwner(session.username, token);
    if (!isOwner) return { error: 'Forbidden' };

    const subData = await db.getSubscription(token);
    if (!subData) return { error: 'Not found' };

    // If enabling, check if there are valid sources
    if (enabled) {
        const allSources = await db.getUpstreamSources();
        const enabledSourceNames = new Set(
            allSources.filter(s => s.enabled !== false).map(s => s.name)
        );

        let isValid = false;
        if (!subData.selectedSources || subData.selectedSources.length === 0) {
            // "All" sources selected. Valid if there is at least one enabled source globally.
            isValid = enabledSourceNames.size > 0;
        } else {
            // Specific sources selected. Valid if at least one selected source is enabled.
            isValid = subData.selectedSources.some(s => enabledSourceNames.has(s));
        }

        if (!isValid) {
            return { error: '无法启用: 该订阅没有可用的上游源 (所有选中的源均已被禁用或删除)' };
        }
    }

    subData.enabled = enabled;
    subData.autoDisabled = false; // Reset auto-disable flag on manual toggle
    await db.updateSubscription(token, subData);

    // Invalidate subscription cache
    await db.deleteCache(`cache:subscription:${token}`);

    revalidatePath('/dashboard');
    return { success: true };
}
