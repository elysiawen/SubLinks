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

    // Immediately refresh upstream cache to parse the new source
    console.log(`🔄 Refreshing upstream cache after adding source: ${name}`);
    const { refreshUpstreamCache } = await import('@/lib/analysis');
    await refreshUpstreamCache();
    console.log(`✅ Upstream cache refreshed successfully`);

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

    const cacheDuration = parseInt(formData.get('cacheDuration') as string) || 24;
    const uaWhitelistStr = formData.get('uaWhitelist') as string;
    const uaWhitelist = uaWhitelistStr
        ? uaWhitelistStr.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    await db.setGlobalConfig({
        ...globalConfig,
        cacheDuration,
        uaWhitelist
    });

    revalidatePath('/admin/sources');
    revalidatePath('/admin/settings');

    return { success: true };
}
