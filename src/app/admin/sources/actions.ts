'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function addUpstreamSource(name: string, url: string, cacheDuration: number = 24, uaWhitelist: string[] = []) {
    const globalConfig = await db.getGlobalConfig();

    let sources: { name: string; url: string; cacheDuration?: number; uaWhitelist?: string[] }[] = [];
    if (globalConfig.upstreamSources && Array.isArray(globalConfig.upstreamSources)) {
        sources = [...globalConfig.upstreamSources];
    }

    // Add new source with settings
    sources.push({ name, url, cacheDuration, uaWhitelist });

    await db.setGlobalConfig({
        ...globalConfig,
        upstreamSources: sources
    });

    // Immediately fetch and cache only the new source
    console.log(`🔄 Fetching new upstream source: ${name}`);
    const { refreshSingleUpstreamSource } = await import('@/lib/analysis');
    await refreshSingleUpstreamSource(name, url);
    console.log(`✅ New upstream source cached successfully`);

    revalidatePath('/admin/sources');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success: true };
}

export async function deleteUpstreamSource(sourceName: string) {
    const globalConfig = await db.getGlobalConfig();

    // Remove from config
    let sources: { name: string; url: string }[] = [];
    if (globalConfig.upstreamSources && Array.isArray(globalConfig.upstreamSources)) {
        sources = globalConfig.upstreamSources.filter(s => s.name !== sourceName);
    }

    await db.setGlobalConfig({
        ...globalConfig,
        upstreamSources: sources
    });

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

    const uaWhitelistStr = formData.get('uaWhitelist') as string;
    const uaWhitelist = uaWhitelistStr
        ? uaWhitelistStr.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    await db.setGlobalConfig({
        ...globalConfig,
        uaWhitelist
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
    uaWhitelist: string[] = []
) {
    const globalConfig = await db.getGlobalConfig();

    let sources: any[] = [];
    if (globalConfig.upstreamSources && Array.isArray(globalConfig.upstreamSources)) {
        sources = [...globalConfig.upstreamSources];
    }

    // Find and update the source
    const index = sources.findIndex(s => s.name === oldName);
    if (index === -1) {
        return { error: 'Source not found' };
    }

    // Preserve existing properties like isDefault, lastUpdated, status, error
    const existingSource = sources[index];
    sources[index] = {
        ...existingSource,
        name: newName,
        url,
        cacheDuration,
        uaWhitelist
    };

    await db.setGlobalConfig({
        ...globalConfig,
        upstreamSources: sources
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

    // Note: We don't refresh upstream cache here - only when adding new sources or force refresh
    // Editing just updates the configuration, actual data refresh happens on schedule or manual trigger

    // Editing just updates the configuration, actual data refresh happens on schedule or manual trigger

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
    const globalConfig = await db.getGlobalConfig();

    // Find the source
    const source = globalConfig.upstreamSources?.find(s => s.name === sourceName);
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
    const globalConfig = await db.getGlobalConfig();

    if (!globalConfig.upstreamSources || globalConfig.upstreamSources.length === 0) {
        return { error: 'No upstream sources configured' };
    }

    // Clear all isDefault flags and set only the selected one
    const updatedSources = globalConfig.upstreamSources.map(source => ({
        ...source,
        isDefault: source.name === sourceName
    }));

    await db.setGlobalConfig({
        ...globalConfig,
        upstreamSources: updatedSources
    });

    revalidatePath('/admin/sources');
    return { success: true };
}
