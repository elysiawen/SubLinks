import { db } from './db';
import yaml from 'js-yaml';
import { parseAndStoreUpstream } from './upstream-parser';

/**
 * Validate that a URL is safe to fetch (not pointing to internal/private addresses)
 * Prevents SSRF attacks when fetching upstream sources
 */
function isAllowedUpstreamUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        // Only allow HTTP and HTTPS
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

        const hostname = parsed.hostname.toLowerCase();

        // Block localhost variants
        if (hostname === 'localhost' || hostname === '0.0.0.0') return false;

        // Block IPv4 loopback and private ranges
        if (/^127\./.test(hostname)) return false;           // 127.x.x.x
        if (/^10\./.test(hostname)) return false;             // 10.x.x.x
        if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false; // 172.16-31.x.x
        if (/^192\.168\./.test(hostname)) return false;       // 192.168.x.x
        if (/^169\.254\./.test(hostname)) return false;       // AWS metadata / link-local

        // Block IPv6 loopback and private
        if (hostname === '::1' || hostname === '[::1]') return false;
        if (hostname.startsWith('fc') || hostname.startsWith('fd')) return false; // ULA
        if (hostname.startsWith('fe80')) return false;        // link-local

        return true;
    } catch {
        return false;
    }
}

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

const runningRefreshes = new Map<string, Promise<boolean>>();

interface RefreshOptions {
    reason?: string;
    trigger?: 'manual' | 'api' | 'schedule' | 'auto';
}

/**
 * Refresh a single upstream source (used when adding new sources)
 */
export async function refreshSingleUpstreamSource(
    sourceName: string,
    sourceUrl: string,
    logger?: (msg: string, type?: 'info' | 'success' | 'error') => void,
    options: RefreshOptions = {}
) {
    // Check if refresh is already running for this source
    if (runningRefreshes.has(sourceName)) {
        const msg = `🔄 Refresh already in progress for [${sourceName}], joining...`;
        console.log(msg);
        if (logger) logger(msg, 'info');
        return runningRefreshes.get(sourceName)!;
    }

    const refreshTask = (async () => {
        try {
            const msg = `📥 Fetching from upstream source [${sourceName}]: ${sourceUrl.substring(0, 50)}...`;
            console.log(msg);
            if (logger) logger(msg, 'info');

            const config = await db.getGlobalConfig();
            const userAgent = config.upstreamUserAgent || 'Clash/Vercel-Sub-Manager';

            // SSRF protection: validate URL before fetching
            if (!isAllowedUpstreamUrl(sourceUrl)) {
                const errorMsg = `   ❌ Source [${sourceName}] rejected: URL points to internal/private address`;
                console.error(errorMsg);
                if (logger) logger(errorMsg, 'error');

                await db.createSystemLog({
                    category: 'error',
                    message: `Upstream source URL rejected (SSRF protection): ${sourceName}`,
                    status: 'failure',
                    details: { url: sourceUrl, trigger: options.trigger },
                    timestamp: Date.now()
                });

                await db.updateUpstreamSource(sourceName, {
                    lastUpdated: Date.now(),
                    status: 'failure',
                    error: 'URL rejected: internal/private address not allowed'
                });

                return false;
            }

            const res = await fetch(sourceUrl, {
                headers: {
                    'User-Agent': userAgent
                }
            });

            if (!res.ok) {
                const errorMsg = `   ❌ Source [${sourceName}] failed: ${res.status}`;
                console.error(errorMsg);
                if (logger) logger(errorMsg, 'error');

                await db.createSystemLog({
                    category: 'error',
                    message: `Failed to fetch upstream source: ${sourceName} (${options.reason || 'Unknown Trigger'})`,
                    status: 'failure',
                    details: { status: res.status, url: sourceUrl, trigger: options.trigger },
                    timestamp: Date.now()
                });

                // Update source status to failure
                await db.updateUpstreamSource(sourceName, {
                    lastUpdated: Date.now(),
                    status: 'failure',
                    error: `HTTP Error: ${res.status}`
                });

                return false;
            }

            // Limit response size to 50MB to prevent OOM from malicious upstreams
            const MAX_UPSTREAM_SIZE = 50 * 1024 * 1024;
            const contentLength = res.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > MAX_UPSTREAM_SIZE) {
                const errorMsg = `   ❌ Source [${sourceName}] rejected: response too large (${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB)`;
                console.error(errorMsg);
                if (logger) logger(errorMsg, 'error');

                await db.updateUpstreamSource(sourceName, {
                    lastUpdated: Date.now(),
                    status: 'failure',
                    error: 'Response too large'
                });

                return false;
            }

            const content = await res.text();
            if (content.length > MAX_UPSTREAM_SIZE) {
                const errorMsg = `   ❌ Source [${sourceName}] rejected: response body too large (${(content.length / 1024 / 1024).toFixed(1)}MB)`;
                console.error(errorMsg);
                if (logger) logger(errorMsg, 'error');

                await db.updateUpstreamSource(sourceName, {
                    lastUpdated: Date.now(),
                    status: 'failure',
                    error: 'Response body too large'
                });

                return false;
            }

            // Parse traffic info from header
            // Format: upload=123; download=456; total=789; expire=1234567890
            const userInfo = res.headers.get('subscription-userinfo') || res.headers.get('Subscription-Userinfo');
            let traffic = undefined;

            if (userInfo) {
                try {
                    const pairs = userInfo.split(';').map(p => p.trim());
                    const info: any = {};
                    pairs.forEach(p => {
                        const [key, value] = p.split('=');
                        if (key && value) info[key] = parseInt(value);
                    });

                    if (info.upload !== undefined && info.download !== undefined && info.total !== undefined) {
                        traffic = {
                            upload: info.upload,
                            download: info.download,
                            total: info.total,
                            expire: info.expire || 0
                        };
                        console.log(`📊 Parsed traffic info for [${sourceName}]:`, traffic);
                    }
                } catch (e) {
                    console.warn(`Failed to parse Subscription-Userinfo for [${sourceName}]: ${userInfo}`, e);
                }
            }

            // Clear existing data for this source before adding new data
            const clearMsg = `   🗑️ Clearing old data for source [${sourceName}]...`;
            console.log(clearMsg);
            if (logger) logger(clearMsg, 'info');

            // Parallelize independent clears
            await Promise.all([
                db.clearProxies(sourceName),
                db.clearProxyGroups(sourceName),
                db.clearRules(sourceName)
            ]);

            // Parse and store with source name
            await parseAndStoreUpstream(content, sourceName, logger);

            const successMsg = `✅ Source [${sourceName}] fetched and parsed successfully.`;
            console.log(successMsg);
            if (logger) logger(successMsg, 'success');

            // Log success with detail
            await db.createSystemLog({
                category: 'update',
                message: `Upstream source added and cached: ${sourceName} [Trigger: ${options.reason || 'Unknown'}]`,
                status: 'success',
                details: { trigger: options.trigger },
                timestamp: Date.now()
            });

            // Update global config with last updated timestamp for specific source
            await db.updateUpstreamSource(sourceName, {
                lastUpdated: Date.now(),
                status: 'success',
                error: undefined, // Clear previous error
                traffic: traffic
            });

            // Update global last updated timestamp
            const globalConfig = await db.getGlobalConfig();
            await db.setGlobalConfig({
                ...globalConfig,
                upstreamLastUpdated: Date.now() // Keep precise global tracking
            });

            // Clear subscription caches that use this source (or all sources)
            const cacheMsg = `   🗑️ Clearing subscription caches affected by source [${sourceName}]...`;
            console.log(cacheMsg);
            if (logger) logger(cacheMsg, 'info');
            const affectedSubs = await db.getSubscriptionsBySource(sourceName);
            // Clear all caches in parallel
            await Promise.all(affectedSubs.map(sub => db.clearSubscriptionCache(sub.token)));

            return true;
        } catch (e) {
            const errorMsg = `Failed to refresh upstream source [${sourceName}]: ${String(e)}`;
            console.error(errorMsg, e);
            if (logger) logger(errorMsg, 'error');
            await db.createSystemLog({
                category: 'error',
                message: `Failed to refresh upstream source: ${sourceName} (${options.reason || 'Unknown Trigger'})`,
                status: 'failure',
                details: { error: String(e), trigger: options.trigger },
                timestamp: Date.now()
            });

            // Update source status to failure on exception
            try {
                await db.updateUpstreamSource(sourceName, {
                    lastUpdated: Date.now(),
                    status: 'failure',
                    error: String(e)
                });
            } catch (dbError) {
                console.error('Failed to update source failure status:', dbError);
            }

            return false;
        } finally {
            runningRefreshes.delete(sourceName);
        }
    })();

    runningRefreshes.set(sourceName, refreshTask);
    return refreshTask;
}


let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh all data from upstream (Proxies, Groups, Rules)
 * This is a heavy operation!
 */
export async function refreshUpstreamCache(
    logger?: (msg: string, type?: 'info' | 'success' | 'error') => void,
    options: RefreshOptions = {}
): Promise<boolean> {
    // If a refresh is already in progress, return the existing promise
    if (refreshPromise) {
        const msg = '🔄 Upstream refresh already in progress, reusing existing promise...';
        console.log(msg);
        if (logger) logger(msg, 'info');
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            const sources = await db.getUpstreamSources();

            if (sources.length === 0) {
                const msg = 'No upstream sources configured, skipping refresh.';
                console.warn(msg);
                if (logger) logger(msg, 'info');
                return false;
            }

            const msg = `📥 Fetching from ${sources.length} upstream source(s)... [Reason: ${options.reason || 'Unknown'}]`;
            console.log(msg);
            if (logger) logger(msg, 'info');

            // Run sequentially to avoid overwhelming (skip static sources)
            const urlSources = sources.filter(s => s.type !== 'static' && s.url);
            for (let i = 0; i < urlSources.length; i++) {
                const source = urlSources[i];
                const progressMsg = `   Processing source ${i + 1}/${urlSources.length} [${source.name}]...`;
                console.log(progressMsg);
                if (logger) logger(progressMsg, 'info');

                await refreshSingleUpstreamSource(source.name, source.url!, logger, options);
            }

            const successMsg = '✅ All upstream sources refreshed successfully.';
            console.log(successMsg);
            if (logger) logger(successMsg, 'success');

            // Update global config with last updated timestamp
            const config = await db.getGlobalConfig();
            await db.setGlobalConfig({
                ...config,
                upstreamLastUpdated: Date.now()
            });

            return true;
        } catch (e) {
            const errorMsg = `Failed to refresh upstream sources: ${e}`;
            console.error(errorMsg);
            if (logger) logger(errorMsg, 'error');
            return false;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

