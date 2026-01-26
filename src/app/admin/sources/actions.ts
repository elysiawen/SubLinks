'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function addUpstreamSource(
    name: string,
    url: string,
    cacheDuration: number = 24,
    enabled: boolean = true,
    skipRefresh: boolean = false
) {
    // Create new upstream source in database
    await db.createUpstreamSource({
        name,
        url,
        cacheDuration,
        enabled,
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

// Helper: Check and disable subscriptions that have no valid sources left
async function validateAndDisableSubscriptions(affectedSubs: any[], enabledSourceNames: Set<string>) {
    let disabledCount = 0;

    // We also need to know if there are ANY enabled sources globally, 
    // because subs with empty selectedSources (meaning "All") depend on *any* source being available.
    const hasAnyGlobalSource = enabledSourceNames.size > 0;

    for (const sub of affectedSubs) {
        if (sub.enabled === false) continue; // Already disabled

        let isValid = false;

        if (!sub.selectedSources || sub.selectedSources.length === 0) {
            // "All" sources selected. Valid if there is at least one enabled source globally.
            isValid = hasAnyGlobalSource;
        } else {
            // Specific sources selected. Valid if at least one selected source is currently enabled.
            // Note: sub.selectedSources is type string[]
            isValid = sub.selectedSources.some((s: string) => enabledSourceNames.has(s));
        }

        if (!isValid) {
            console.log(`⚠️ Subscription ${sub.token} (${sub.username}) has no valid sources left. Disabling...`);

            // Update subscription status
            sub.enabled = false;
            sub.autoDisabled = true; // Mark as auto-disabled so we can restore it later
            await db.updateSubscription(sub.token, sub);

            // Clear cache for this subscription
            await db.clearSubscriptionCache(sub.token);

            disabledCount++;
        }
    }

    if (disabledCount > 0) {
        console.log(`🚫 Auto-disabled ${disabledCount} subscriptions due to lack of valid sources.`);
    }
}

export async function deleteUpstreamSource(sourceName: string) {
    // 1. Find affected subscriptions BEFORE deleting (so we know who used this source)
    const affectedSubs = await db.getSubscriptionsBySource(sourceName);

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

    // 2. Validate affected subscriptions
    // Get currently enabled sources (excluding the one we just deleted)
    const allSources = await db.getUpstreamSources();
    const enabledSourceNames = new Set(
        allSources
            .filter(s => s.enabled !== false && s.name !== sourceName)
            .map(s => s.name)
    );

    await validateAndDisableSubscriptions(affectedSubs, enabledSourceNames);

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
    enabled: boolean = true,
    skipRefresh: boolean = false
) {
    // Update upstream source in database
    await db.updateUpstreamSource(oldName, {
        name: newName,
        url,
        cacheDuration,
        enabled
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

export async function toggleUpstreamSourceEnabled(sourceName: string, enabled: boolean) {
    await db.updateUpstreamSource(sourceName, { enabled });

    // If disabling, clear caches for AFFECTED subscriptions only AND check if they need to be disabled
    if (!enabled) {
        console.log(`🚫 Source "${sourceName}" disabled, finding affected subscriptions...`);
        const affectedSubs = await db.getSubscriptionsBySource(sourceName);
        console.log(`   Found ${affectedSubs.length} affected subscriptions.`);

        // 1. Clear caches
        const CHUNK_SIZE = 50;
        for (let i = 0; i < affectedSubs.length; i += CHUNK_SIZE) {
            const chunk = affectedSubs.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(sub => db.clearSubscriptionCache(sub.token)));
        }
        console.log(`✅ Cleared subscription caches.`);

        // 2. Check if subscriptions should be auto-disabled
        const allSources = await db.getUpstreamSources();
        const enabledSourceNames = new Set(
            allSources
                .filter(s => s.enabled !== false)
                .map(s => s.name)
        );

        // Double check exclusion
        if (enabledSourceNames.has(sourceName)) {
            enabledSourceNames.delete(sourceName);
        }

        await validateAndDisableSubscriptions(affectedSubs, enabledSourceNames);
    } else {
        // If Enabling: Check if we can RESTORE any auto-disabled subscriptions
        console.log(`✅ Source "${sourceName}" enabled, checking for auto-disabled subscriptions to restore...`);

        // Find subscriptions that use this source (or "All")
        const affectedSubs = await db.getSubscriptionsBySource(sourceName);
        const autoDisabledSubs = affectedSubs.filter(sub => sub.enabled === false && sub.autoDisabled === true);

        if (autoDisabledSubs.length > 0) {
            console.log(`   Found ${autoDisabledSubs.length} auto-disabled subscriptions. Attempting to restore...`);

            // Get all enabled sources (now including this one)
            const allSources = await db.getUpstreamSources();
            const enabledSourceNames = new Set(
                allSources
                    .filter(s => s.enabled !== false)
                    .map(s => s.name)
            );

            // For good measure, ensure this source is considered enabled (DB consistency check)
            enabledSourceNames.add(sourceName);
            const hasAnyGlobalSource = enabledSourceNames.size > 0;

            let restoredCount = 0;
            for (const sub of autoDisabledSubs) {
                let isValid = false;
                if (!sub.selectedSources || sub.selectedSources.length === 0) {
                    isValid = hasAnyGlobalSource;
                } else {
                    isValid = sub.selectedSources.some((s: string) => enabledSourceNames.has(s));
                }

                if (isValid) {
                    sub.enabled = true;
                    sub.autoDisabled = false; // Reset flag
                    await db.updateSubscription(sub.token, sub);
                    await db.clearSubscriptionCache(sub.token);
                    restoredCount++;
                    console.log(`   Restored subscription: ${sub.username} (${sub.token})`);
                }
            }
            console.log(`✅ Restored ${restoredCount} subscriptions.`);
        } else {
            console.log(`   No auto-disabled subscriptions found.`);
        }
    }

    revalidatePath('/admin/sources');
    return { success: true };
}

// Wrapper for updateRefreshApiKey from config-actions
export async function updateRefreshApiKey(apiKey: string | null) {
    const { updateRefreshApiKey: updateKey } = await import('@/lib/config-actions');
    return await updateKey(apiKey);
}
