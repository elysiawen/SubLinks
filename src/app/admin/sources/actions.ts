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
        type: 'url',
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

/**
 * Add a new static upstream source.
 * Parses the provided content (YAML config, share links, etc.) into proxies,
 * proxy groups, and rules. The raw content is discarded after parsing.
 * A default proxy group is automatically created if none are provided.
 */
export async function addStaticUpstreamSource(
    name: string,
    content: string,
    enabled: boolean = true
) {
    // 1. Create the upstream source entry in database
    await db.createUpstreamSource({
        name,
        type: 'static',
        enabled,
        isDefault: false,
        lastUpdated: Date.now(),
        status: 'success' // Static sources are always "successful" since no fetch is needed
    });

    // 2. Parse content and store nodes/groups/rules
    console.log(`📦 Parsing static upstream source: ${name}`);
    const { parseAndStoreUpstream } = await import('@/lib/upstream-parser');
    await parseAndStoreUpstream(content, name);
    console.log(`✅ Static upstream source parsed and stored successfully`);

    // 3. Clear all subscription caches so users immediately get the new nodes
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success: true };
}

/**
 * Append additional nodes to an existing static upstream source.
 * Used when editing a static source to add more nodes via links/config.
 * Does NOT clear existing nodes - only adds new ones on top.
 */
export async function appendNodesToStaticSource(
    sourceName: string,
    content: string
) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source) {
        return { error: 'Source not found' };
    }
    if (source.type !== 'static') {
        return { error: 'Can only append nodes to static sources' };
    }

    console.log(`📦 Appending nodes to static source: ${sourceName}`);
    const { parseAndStoreUpstream } = await import('@/lib/upstream-parser');
    // Parse content (adds to existing, does not clear first)
    await parseAndStoreUpstream(content, sourceName);

    // Update lastUpdated timestamp
    await db.updateUpstreamSource(sourceName, {
        lastUpdated: Date.now()
    });

    // Clear subscription caches
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
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
    // Verify that type is not being changed
    const existingSource = await db.getUpstreamSource(oldName);
    if (!existingSource) {
        return { error: 'Source not found' };
    }

    const isStatic = existingSource.type === 'static';

    // Update upstream source in database (never change type)
    await db.updateUpstreamSource(oldName, {
        name: newName,
        ...(isStatic ? {} : { url, cacheDuration }), // Static sources don't have URL/cache
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

    if (isStatic) {
        // Static sources: clear subscription caches to propagate any name/enabled changes
        await db.clearAllSubscriptionCaches();
    } else {
        // URL sources: conditionally trigger immediate refresh after update
        if (!skipRefresh && url) {
            console.log(`🔄 Refreshing updated upstream source: ${newName}`);
            const { refreshSingleUpstreamSource } = await import('@/lib/analysis');
            await refreshSingleUpstreamSource(newName, url, undefined, { reason: 'Source Update', trigger: 'manual' });
        }
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
    // Static sources cannot be refreshed via URL
    if (source.type === 'static' || !source.url) {
        return { error: 'Static sources cannot be refreshed' };
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

// ===== Static Source Management Actions =====

/**
 * Preview-parse content without saving to database.
 * Returns parsed proxies, groups, and rules for wizard preview.
 */
export async function previewParseContent(content: string) {
    const { parseContentPreview } = await import('@/lib/upstream-parser');
    return parseContentPreview(content);
}

/**
 * Get all data (nodes, proxy groups, rules) for a static source.
 */
export async function getStaticSourceData(sourceName: string) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    const proxies = await db.getProxies(sourceName);
    const groups = await db.getProxyGroups(sourceName);
    const rules = await db.getRules(sourceName);

    return {
        proxies: proxies.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            server: p.config?.server || p.server,
            port: p.config?.port || p.port,
            config: p.config
        })),
        groups: groups.map(g => ({
            id: g.id,
            name: g.name,
            type: g.type,
            proxies: g.proxies,
            config: g.config
        })),
        rules: rules.map(r => ({
            id: r.id,
            ruleText: r.ruleText,
            priority: r.priority
        }))
    };
}

/**
 * Create a static upstream source with pre-parsed nodes.
 * Used by the wizard after user has reviewed the parsed content.
 */
export async function createStaticSource(
    name: string,
    nodes: { name: string; type: string; server: string; port: number; config: any }[],
    groups: { name: string; type: string; proxies: string[] }[],
    rules: string[],
    enabled: boolean = true
) {
    if (nodes.length === 0) {
        return { error: '至少需要一个节点' };
    }

    // Check name uniqueness
    const existing = await db.getUpstreamSource(name);
    if (existing) {
        return { error: '上游源名称已存在' };
    }

    // 1. Create upstream source entry
    await db.createUpstreamSource({
        name,
        type: 'static',
        enabled,
        isDefault: false,
        lastUpdated: Date.now(),
        status: 'success'
    });

    // 2. Save proxies
    const { nanoid } = await import('nanoid');
    const proxyEntries = nodes.map(n => ({
        id: nanoid(),
        name: n.name,
        type: n.type,
        server: n.server,
        port: n.port,
        config: n.config,
        source: name,
        createdAt: Date.now(),
    }));
    await db.saveProxies(proxyEntries);

    // 3. Save proxy groups (or create default)
    if (groups.length > 0) {
        const groupEntries = groups.map((g, i) => ({
            id: nanoid(),
            name: g.name,
            type: g.type,
            proxies: g.proxies,
            config: {},
            source: name,
            priority: i,
            createdAt: Date.now(),
        }));
        await db.saveProxyGroups(groupEntries);
    }

    // Always ensure a default group exists
    const existingGroups = await db.getProxyGroups(name);
    if (existingGroups.length === 0) {
        await db.saveProxyGroups([{
            id: nanoid(),
            name: 'default',
            type: 'select',
            proxies: [`SOURCE:${name}`],
            config: {},
            source: name,
            priority: 0,
            createdAt: Date.now(),
        }]);
    }

    // 4. Save rules
    if (rules.length > 0) {
        const ruleEntries = rules.map((r, i) => ({
            id: nanoid(),
            ruleText: r,
            priority: i,
            source: name,
            createdAt: Date.now(),
        }));
        await db.saveRules(ruleEntries);
    }

    // 5. Clear subscription caches
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success: true };
}

/**
 * Add pre-parsed nodes to an existing static source.
 */
export async function addNodesToStaticSource(
    sourceName: string,
    nodes: { name: string; type: string; server: string; port: number; config: any }[]
) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    const { nanoid } = await import('nanoid');
    const proxyEntries = nodes.map(n => ({
        id: nanoid(),
        name: n.name,
        type: n.type,
        server: n.server,
        port: n.port,
        config: n.config,
        source: sourceName,
        createdAt: Date.now(),
    }));
    await db.saveProxies(proxyEntries);

    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    return { success: true };
}

/**
 * Delete a single node from a static source.
 */
export async function deleteStaticSourceNode(sourceName: string, nodeId: string) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    await db.deleteProxy(nodeId);
    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    return { success: true };
}

/**
 * Delete multiple nodes from a static source.
 */
export async function deleteStaticSourceNodes(sourceName: string, nodeIds: string[]) {
    if (!nodeIds || nodeIds.length === 0) return { success: true };

    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    // Loop and delete
    for (const id of nodeIds) {
        await db.deleteProxy(id);
    }

    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    return { success: true };
}

/**
 * Save proxy groups for a static source (replaces all existing groups).
 */
export async function saveStaticSourceGroups(
    sourceName: string,
    groups: { id?: string; name: string; type: string; proxies: string[]; config?: any }[]
) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    const { nanoid } = await import('nanoid');

    // Clear existing and save new
    await db.clearProxyGroups(sourceName);
    const groupEntries = groups.map((g, i) => ({
        id: g.id || nanoid(),
        name: g.name,
        type: g.type,
        proxies: g.proxies,
        config: g.config || {},
        source: sourceName,
        priority: i,
        createdAt: Date.now(),
    }));
    await db.saveProxyGroups(groupEntries);

    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/groups');
    return { success: true };
}

/**
 * Delete a single proxy group. Protected: can't delete if it's the only group.
 */
export async function deleteStaticSourceGroup(sourceName: string, groupId: string) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    const groups = await db.getProxyGroups(sourceName);
    if (groups.length <= 1) {
        return { error: '至少保留一个策略组，不能删除唯一的策略组' };
    }

    await db.deleteProxyGroup(groupId);
    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/groups');
    return { success: true };
}

/**
 * Save rules for a static source (replaces all existing rules).
 */
export async function saveStaticSourceRules(
    sourceName: string,
    ruleTexts: string[]
) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    const { nanoid } = await import('nanoid');

    // Clear existing and save new
    await db.clearRules(sourceName);
    if (ruleTexts.length > 0) {
        const ruleEntries = ruleTexts.map((r, i) => ({
            id: nanoid(),
            ruleText: r,
            priority: i,
            source: sourceName,
            createdAt: Date.now(),
        }));
        await db.saveRules(ruleEntries);
    }

    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/rules');
    return { success: true };
}

/**
 * Delete a single rule from a static source.
 */
export async function deleteStaticSourceRule(sourceName: string, ruleId: string) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    await db.deleteRule(ruleId);
    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/rules');
    return { success: true };
}

/**
 * Import static source data with granular control (nodes, groups, rules).
 * Supports appending 	"or" overwriting for groups and rules.
 */
export async function importStaticSourceData(
    sourceName: string,
    data: {
        nodes?: { name: string; type: string; server: string; port: number; config: any }[];
        groups?: { name: string; type: string; proxies: string[] }[];
        rules?: string[];
    },
    options: {
        importNodes: boolean;
        importGroups: boolean;
        importRules: boolean;
        nodeMode: 'append' | 'overwrite';
        groupMode: 'append' | 'overwrite';
        ruleMode: 'append' | 'overwrite';
    }
) {
    const source = await db.getUpstreamSource(sourceName);
    if (!source || source.type !== 'static') {
        return { error: '源不存在或不是静态类型' };
    }

    const { nanoid } = await import('nanoid');

    // 1. Import Nodes
    if (options.importNodes && data.nodes && data.nodes.length > 0) {
        const proxyEntries = data.nodes.map(n => ({
            id: nanoid(),
            name: n.name,
            type: n.type,
            server: n.server,
            port: n.port,
            config: n.config,
            source: sourceName,
            createdAt: Date.now(),
        }));

        if (options.nodeMode === 'overwrite') {
            await db.clearProxies(sourceName);
        }
        await db.saveProxies(proxyEntries);
    }

    // 2. Import Groups
    if (options.importGroups && data.groups && data.groups.length > 0) {
        let finalGroups = data.groups.map((g, i) => ({
            id: nanoid(),
            name: g.name,
            type: g.type,
            proxies: g.proxies,
            config: {},
            source: sourceName,
            priority: i,
            createdAt: Date.now(),
        }));

        if (options.groupMode === 'append') {
            const existingGroups = await db.getProxyGroups(sourceName);
            // Append and adjust priorities
            const startPriority = existingGroups.length;
            finalGroups = finalGroups.map((g, i) => ({ ...g, priority: startPriority + i }));
            await db.saveProxyGroups(finalGroups);
        } else {
            // Overwrite
            await db.clearProxyGroups(sourceName);
            await db.saveProxyGroups(finalGroups);
        }
    }

    // 3. Import Rules
    if (options.importRules && data.rules && data.rules.length > 0) {
        let finalRules = data.rules.map((r, i) => ({
            id: nanoid(),
            ruleText: r,
            priority: i,
            source: sourceName,
            createdAt: Date.now(),
        }));

        if (options.ruleMode === 'append') {
            const existingRules = await db.getRules(sourceName);
            const startPriority = existingRules.length;
            finalRules = finalRules.map((r, i) => ({ ...r, priority: startPriority + i }));
            await db.saveRules(finalRules);
        } else {
            // Overwrite
            await db.clearRules(sourceName);
            await db.saveRules(finalRules);
        }
    }

    await db.updateUpstreamSource(sourceName, { lastUpdated: Date.now() });
    await db.clearAllSubscriptionCaches();

    revalidatePath('/admin/sources');
    revalidatePath('/admin/proxies');
    revalidatePath('/admin/groups');
    revalidatePath('/admin/rules');

    return { success: true };
}
