'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function addUpstreamSource(
    name: string,
    url: string,
    cacheDuration: number = 24,
    skipRefresh: boolean = false
) {
    // Create new upstream source in database
    await db.createUpstreamSource({
        name,
        url,
        cacheDuration,

        isDefault: false,
        lastUpdated: 0,
        status: 'pending'
    });

    // Conditionally fetch and cache the new source
    if (!skipRefresh) {
        console.log(`🔄 Fetching new upstream source: ${name}`);
        const { refreshSingleUpstreamSource } = await import('@/lib/analysis');
        await refreshSingleUpstreamSource(name, url);
        console.log(`✅ New upstream source cached successfully`);
    }

    revalidatePath('/admin/sources');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success: true };
}

export async function deleteUpstreamSource(sourceName: string) {
    // Delete all data from this source
    console.log(`🗑️ Deleting all data from source: ${sourceName}`);

    // Delete proxies
    const proxies = await db.getProxies(sourceName);
    console.log(`   Deleting ${proxies.length} proxies...`);
    await db.clearProxies(sourceName);

    // Delete proxy groups
    const groups = await db.getProxyGroups(sourceName);
    console.log(`   Deleting ${groups.length} proxy groups...`);
    await db.clearProxyGroups(sourceName);

    // Delete rules
    const rules = await db.getRules(sourceName);
    console.log(`   Deleting ${rules.length} rules...`);
    await db.clearRules(sourceName);

    // Delete upstream source from database
    await db.deleteUpstreamSource(sourceName);

    console.log(`✅ Successfully deleted source "${sourceName}" and all related data`);

    revalidatePath('/admin/sources');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success: true };
}

export async function updateSystemSettings(formData: FormData) {
    const globalConfig = await db.getGlobalConfig();

    await db.setGlobalConfig({
        ...globalConfig
    });

    revalidatePath('/admin/sources');
    revalidatePath('/admin/settings');

    return { success: true };
}

export async function updateUpstreamSource(
    oldName: string,
    newName: string,
    url: string,
    cacheDuration: number = 24,

    skipRefresh: boolean = false
) {
    // Update upstream source in database
    await db.updateUpstreamSource(oldName, {
        name: newName,
        url,
        cacheDuration,

    });

    // If name changed, we need to update the source tag in database
    if (oldName !== newName) {
        // Get all data with old source name
        const proxies = await db.getProxies(oldName);
        const groups = await db.getProxyGroups(oldName);
        const rules = await db.getRules(oldName);

        // Clear old source data
        await db.clearProxies(oldName);
        await db.clearProxyGroups(oldName);
        await db.clearRules(oldName);

        // Re-save with new source name
        if (proxies.length > 0) {
            await db.saveProxies(proxies.map(p => ({ ...p, source: newName })));
        }
        if (groups.length > 0) {
            await db.saveProxyGroups(groups.map(g => ({ ...g, source: newName })));
        }
        if (rules.length > 0) {
            await db.saveRules(rules.map(r => ({ ...r, source: newName })));
        }
    }

    // Conditionally trigger immediate refresh after update
    if (!skipRefresh) {
        console.log(`🔄 Refreshing updated upstream source: ${newName}`);
        const { refreshSingleUpstreamSource } = await import('@/lib/analysis');
        await refreshSingleUpstreamSource(newName, url, undefined, { reason: 'Source Update', trigger: 'manual' });
    }

    revalidatePath('/admin/sources');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success: true };
}

export async function forceRefreshUpstream() {
    console.log('🔄 Force refreshing all upstream sources...');
    const { refreshUpstreamCache } = await import('@/lib/analysis');
    const success = await refreshUpstreamCache();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success };
}

export async function refreshSingleSource(sourceName: string) {
    // Find the source from database
    const source = await db.getUpstreamSource(sourceName);
    if (!source) {
        return { error: 'Source not found' };
    }

    console.log(`🔄 Refreshing single upstream source: ${sourceName}`);
    const { refreshSingleUpstreamSource } = await import('@/lib/analysis');
    const success = await refreshSingleUpstreamSource(source.name, source.url);

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success };
}

export async function setDefaultUpstreamSource(sourceName: string) {
    // Set default upstream source in database
    await db.setDefaultUpstreamSource(sourceName);

    revalidatePath('/admin/sources');
    return { success: true };
}

// Wrapper for updateRefreshApiKey from config-actions
export async function updateRefreshApiKey(apiKey: string | null) {
    const { updateRefreshApiKey: updateKey } = await import('@/lib/config-actions');
    return await updateKey(apiKey);
}
