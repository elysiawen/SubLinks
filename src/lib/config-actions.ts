'use server'

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import type { ConfigSet } from './database/interface';

export { type ConfigSet };

// Helper to get current user session
async function getCurrentUserSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;
    return await getSession(sessionId);
}

// --- Groups Management (User-scoped) ---

export async function getGroupSets(): Promise<ConfigSet[]> {
    const session = await getCurrentUserSession();
    if (!session) throw new Error('未授权');
    const sets = await db.getCustomGroups(session.userId);
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveGroupSet(id: string | null, name: string, content: string) {
    const session = await getCurrentUserSession();
    if (!session) throw new Error('未授权');
    await db.saveCustomGroup(id, session.userId, name, content, false);
    revalidatePath('/dashboard/custom/groups');
    return { success: true };
}

export async function deleteGroupSet(id: string) {
    const session = await getCurrentUserSession();
    if (!session) throw new Error('未授权');
    await db.deleteCustomGroup(id, session.userId);
    revalidatePath('/dashboard/custom/groups');
}

// --- Rules Management (User-scoped) ---

export async function getRuleSets(): Promise<ConfigSet[]> {
    const session = await getCurrentUserSession();
    if (!session) throw new Error('未授权');
    const sets = await db.getCustomRules(session.userId);
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveRuleSet(id: string | null, name: string, content: string) {
    const session = await getCurrentUserSession();
    if (!session) throw new Error('未授权');
    await db.saveCustomRule(id, session.userId, name, content, false);
    revalidatePath('/dashboard/custom/rules');
    return { success: true };
}

export async function deleteRuleSet(id: string) {
    const session = await getCurrentUserSession();
    if (!session) throw new Error('未授权');
    await db.deleteCustomRule(id, session.userId);
    revalidatePath('/dashboard/custom/rules');
}

// --- Admin Methods (All configs) ---

export async function getAllGroupSetsAdmin(): Promise<ConfigSet[]> {
    const session = await getCurrentUserSession();
    if (!session || session.role !== 'admin') throw new Error('需要管理员权限');
    const sets = await db.getAllCustomGroups();
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveGroupSetAdmin(id: string | null, name: string, content: string, isGlobal: boolean) {
    const session = await getCurrentUserSession();
    if (!session || session.role !== 'admin') throw new Error('需要管理员权限');
    await db.saveCustomGroup(id, session.userId, name, content, isGlobal);
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard/custom/groups');
    return { success: true };
}

export async function getAllRuleSetsAdmin(): Promise<ConfigSet[]> {
    const session = await getCurrentUserSession();
    if (!session || session.role !== 'admin') throw new Error('需要管理员权限');
    const sets = await db.getAllCustomRules();
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveRuleSetAdmin(id: string | null, name: string, content: string, isGlobal: boolean) {
    const session = await getCurrentUserSession();
    if (!session || session.role !== 'admin') throw new Error('需要管理员权限');
    await db.saveCustomRule(id, session.userId, name, content, isGlobal);
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard/custom/rules');
    return { success: true };
}

// --- Upstream Source Refresh ---

export async function refreshUpstreamSource(
    sourceName: string,
    options: { reason?: string; trigger?: 'manual' | 'api' | 'schedule' | 'auto' } = {}
) {
    const source = await db.getUpstreamSourceByName(sourceName);
    if (!source) {
        throw new Error(`Source not found: ${sourceName}`);
    }

    // Call the actual refresh logic from analysis.ts
    const { refreshSingleUpstreamSource } = await import('@/lib/analysis');
    const success = await refreshSingleUpstreamSource(source.name, source.url, undefined, options);

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success };
}

// --- Refresh API Key Management ---

export async function updateRefreshApiKey(apiKey: string | null) {
    const config = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...config,
        refreshApiKey: apiKey || undefined
    });
    revalidatePath('/admin/sources');
    return { success: true };
}

// --- Data Fetching Helpers (for client-side loading) ---

export async function getProxyGroups() {
    return await db.getProxyGroups();
}

export async function getUpstreamSources() {
    return await db.getUpstreamSources();
}
