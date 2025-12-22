import { db } from './db';
import yaml from 'js-yaml';
import { parseAndStoreUpstream } from './upstream-parser';

export interface Proxy {
    name: string;
    type: string;
    server?: string;
    port?: number;
    cipher?: string;
    uuid?: string;
    [key: string]: any;
}

export interface ProxyGroup {
    name: string;
    type: string;
    proxies: string[];
    [key: string]: any;
}

export interface ClashConfig {
    proxies: Proxy[];
    'proxy-groups': ProxyGroup[];
    rules: string[];
    [key: string]: any;
}

/**
 * Get parsed config from structured database
 */
export async function getParsedConfig(): Promise<ClashConfig | null> {
    try {
        // Read from structured database instead of cache
        const proxies = await db.getProxies('upstream');
        const groups = await db.getProxyGroups('upstream');
        const rules = await db.getRules('upstream');
        const upstreamConfig = await db.getAllUpstreamConfig();

        return {
            proxies: proxies.map(p => p.config),
            'proxy-groups': groups.map(g => ({
                name: g.name,
                type: g.type,
                proxies: g.proxies,
                ...g.config,
            })),
            rules: rules.map(r => r.ruleText),
            ...upstreamConfig,
        };
    } catch (e) {
        console.error('Failed to get parsed config from database:', e);
        return null;
    }
}

/**
 * Refresh a single upstream source (used when adding new sources)
 */
export async function refreshSingleUpstreamSource(sourceName: string, sourceUrl: string) {
    try {
        console.log(`📥 Fetching from upstream source [${sourceName}]: ${sourceUrl.substring(0, 50)}...`);

        const res = await fetch(sourceUrl, {
            headers: {
                'User-Agent': 'Clash/Vercel-Sub-Manager'
            }
        });

        if (!res.ok) {
            console.error(`   ❌ Source [${sourceName}] failed: ${res.status}`);
            await db.createSystemLog({
                category: 'error',
                message: `Failed to fetch upstream source: ${sourceName}`,
                status: 'failure',
                details: { status: res.status, url: sourceUrl },
                timestamp: Date.now()
            });
            return false;
        }

        const content = await res.text();

        // Clear existing data for this source before adding new data
        console.log(`   🗑️ Clearing old data for source [${sourceName}]...`);
        await db.clearProxies(sourceName);
        await db.clearProxyGroups(sourceName);
        await db.clearRules(sourceName);

        // Parse and store with source name
        await parseAndStoreUpstream(content, sourceName);

        console.log(`✅ Source [${sourceName}] fetched and parsed successfully.`);

        // Log success
        await db.createSystemLog({
            category: 'update',
            message: `Upstream source added and cached: ${sourceName}`,
            status: 'success',
            details: { source: sourceName },
            timestamp: Date.now()
        });

        // Clear all subscription caches to ensure they pick up the new/updated source data
        console.log('🗑️ Clearing all subscription caches (triggered by single source update)...');
        await db.clearAllSubscriptionCaches();

        return true;
    } catch (e) {
        console.error(`Failed to refresh upstream source [${sourceName}]:`, e);
        await db.createSystemLog({
            category: 'error',
            message: `Failed to refresh upstream source: ${sourceName}`,
            status: 'failure',
            details: { error: String(e) },
            timestamp: Date.now()
        });
        return false;
    }
}


let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh all upstream sources
 */
export async function refreshUpstreamCache() {
    // If a refresh is already in progress, return the existing promise
    if (refreshPromise) {
        console.log('🔄 Upstream refresh already in progress, reusing existing promise...');
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            const config = await db.getGlobalConfig();
            const cacheDuration = (config.cacheDuration || 24) * 3600;

            // Get upstream sources - support both new and legacy formats
            let sources: { name: string; url: string }[] = [];

            if (config.upstreamSources && Array.isArray(config.upstreamSources)) {
                // New format with names
                sources = config.upstreamSources;
            } else if (config.upstreamUrl) {
                // Legacy format - convert to sources
                const urls = Array.isArray(config.upstreamUrl) ? config.upstreamUrl : [config.upstreamUrl];
                sources = urls.map((url: string | { url: string }, i) => ({
                    name: `upstream_${i}`,
                    url: typeof url === 'string' ? url : url.url || ''
                }));
            }

            if (sources.length === 0) {
                console.warn('No upstream sources configured, skipping refresh.');
                return false;
            }

            console.log(`📥 Fetching from ${sources.length} upstream source(s)...`);

            let allContent = '';

            // Fetch from all sources
            for (let i = 0; i < sources.length; i++) {
                const source = sources[i];
                console.log(`   Fetching source ${i + 1}/${sources.length} [${source.name}]: ${source.url.substring(0, 50)}...`);

                try {
                    // Clear existing data for this source before fetching new data
                    console.log(`   🗑️ Clearing old data for source [${source.name}]...`);
                    await db.clearProxies(source.name);
                    await db.clearProxyGroups(source.name);
                    await db.clearRules(source.name);

                    const res = await fetch(source.url, {
                        headers: {
                            'User-Agent': 'Clash/Vercel-Sub-Manager'
                        }
                    });

                    if (!res.ok) {
                        console.error(`   ❌ Source [${source.name}] failed: ${res.status}`);
                        continue;
                    }

                    const content = await res.text();

                    // Parse and store with source name
                    await parseAndStoreUpstream(content, source.name);

                    // Keep first source as main cache for backward compatibility
                    if (i === 0) {
                        allContent = content;
                    }

                    console.log(`   ✓ Source [${source.name}] parsed successfully`);
                } catch (error) {
                    console.error(`   ❌ Source [${source.name}] error:`, error);
                }
            }

            // Save raw cache (for backup/fallback) - use first source
            if (allContent) {
                await db.setCache('cache:subscription', allContent, cacheDuration);
            }

            console.log('✅ All upstream sources refreshed successfully.');

            // Clear all subscription caches to force regeneration with new upstream data
            console.log('🗑️ Clearing all subscription caches...');
            await db.clearAllSubscriptionCaches();
            console.log('✅ Subscription caches cleared.');

            // Log system event
            try {
                await db.createSystemLog({
                    category: 'update',
                    message: `Upstream sources refreshed: ${sources.length} sources processed`,
                    status: 'success',
                    details: { sources: sources.map(s => s.name) },
                    timestamp: Date.now()
                });
            } catch (e) {
                console.error('Failed to create system log:', e);
            }

            return true;

        } catch (e) {
            console.error('Failed to refresh upstream cache:', e);

            // Log system error
            try {
                await db.createSystemLog({
                    category: 'error',
                    message: 'Failed to refresh upstream cache',
                    status: 'failure',
                    details: { error: String(e) },
                    timestamp: Date.now()
                });
            } catch (logError) {
                console.error('Failed to create system log for error:', logError);
            }

            return false;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}
