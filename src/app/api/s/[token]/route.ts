import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildSubscriptionYaml } from '@/lib/subscription-builder';

// Runtime must be nodejs for database clients
export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    // 1. Get Subscription
    const sub = await db.getSubscription(token);

    // Helper to log access
    const logAccess = async (status: number) => {
        if (!sub) return; // Only log if token correlates to a subscription
        const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
        const ua = request.headers.get('user-agent') || 'Unknown';
        try {
            await db.createAPIAccessLog({
                token,
                username: sub.username,
                ip,
                ua,
                status,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error('Failed to log API access:', e);
        }
    };

    if (!sub || sub.enabled === false) {
        if (sub) await logAccess(403);
        return new NextResponse('Invalid Subscription Token. Please contact admin.', { status: 403 });
    }

    // Check User Status (Owner)
    const user = await db.getUser(sub.username);
    if (!user || user.status !== 'active') {
        await logAccess(403);
        return new NextResponse('User Account Suspended', { status: 403 });
    }

    // 2. Get Global Config and Upstream Sources
    const config = await db.getGlobalConfig();
    const upstreamUrl = config.upstreamUrl;
    const upstreamSources = await db.getUpstreamSources();

    if (!upstreamUrl && upstreamSources.length === 0) {
        await logAccess(500);
        return new NextResponse('Server Configuration Error: No Upstream URL Set', { status: 500 });
    }

    // 3. Calculate effective settings from selected sources
    let effectiveCacheDuration = 24; // Default to 24 hours if no specific source duration
    let effectiveUaWhitelist = config.uaWhitelist || [];

    const selectedSourceNames = sub.selectedSources || [];

    // Enforce selection of at least one upstream source
    if (selectedSourceNames.length === 0) {
        console.warn(`[API] Subscription ${token} has no upstream sources selected.`);
        await logAccess(400);
        return new NextResponse('Configuration Error: No Upstream Sources Selected. Please edit the subscription to select at least one source.', { status: 400 });
    }

    if (selectedSourceNames.length > 0 && upstreamSources.length > 0) {
        const selectedSources = upstreamSources.filter(s => selectedSourceNames.includes(s.name));

        // Use minimum cache duration from selected sources if available
        const sourceDurations = selectedSources.map(s => s.cacheDuration).filter(d => d !== undefined) as number[];

        // Handle infinite cache (0) mixed with finite durations
        // If we have mixed 0 and non-0, the subscription should expire based on the SHORTEST finite duration.
        // If all are 0, then it is infinite.
        const finiteDurations = sourceDurations.filter(d => d > 0);

        if (finiteDurations.length > 0) {
            effectiveCacheDuration = Math.min(...finiteDurations);
        } else if (sourceDurations.some(d => d === 0)) {
            effectiveCacheDuration = 0; // All sources are infinite
        }

        // Merge UA whitelists
        const sourceWhitelists = selectedSources.flatMap(s => s.uaWhitelist || []);
        if (sourceWhitelists.length > 0) {
            effectiveUaWhitelist = Array.from(new Set([...effectiveUaWhitelist, ...sourceWhitelists]));
        }
    }

    // 4. User Agent Check
    if (effectiveUaWhitelist.length > 0) {
        const ua = request.headers.get('user-agent') || '';
        const allowed = effectiveUaWhitelist.some((w: string) => ua.includes(w));
        if (!allowed) {
            await logAccess(403);
            return new NextResponse('Client Not Allowed', { status: 403 });
        }
    }

    // 5. Ensure upstream data is cached and parsed, and check freshness

    // We check freshness FIRST. If fresh, we check if we have a compiled result.
    const cacheDuration = effectiveCacheDuration;
    const cacheKey = `cache:subscription:${token}`;

    // Check freshness for each selected source individually
    const sourcesToCheck = upstreamSources.length > 0 && selectedSourceNames.length > 0
        ? upstreamSources.filter(s => selectedSourceNames.includes(s.name))
        : upstreamSources;

    const now = Date.now();
    const staleSources: string[] = [];

    try {
        for (const source of sourcesToCheck) {
            // cacheDuration: 0 means never expire. If undefined, default to 24h as safety legacy fallback? 
            // User requested "Must configure". Let's say if NOT 0 and NOT defined -> 24h default?
            // User said: "must configure cache time, if 0 then cache does not expire"
            // If it is undefined, we probably should treat it as "not configured" -> maybe default 24h or error?
            // Given existing data might be missing it, defaulting to 24h for undefined is safer than 0.
            // But if it IS 0, we skip check.

            const durationHours = source.cacheDuration;

            // cacheDuration: 0 means never expire
            if (durationHours === 0 || Number(durationHours) === 0) {
                // Never expires, but we must ensure it has been fetched at least once
                // If never updated (lastUpdated is 0 or undefined), we MUST fetch it
                if (!source.lastUpdated || source.lastUpdated === 0) {
                    staleSources.push(source.name);
                }
                // If already fetched, skip freshness check entirely
                continue;
            }

            // For non-zero durations, check freshness
            const effectiveDuration = durationHours ?? 24; // Use nullish coalescing to preserve 0
            const maxAgeMs = effectiveDuration * 60 * 60 * 1000;
            const lastUpdated = source.lastUpdated || 0;
            const currentAge = now - lastUpdated;

            const isStale = currentAge > maxAgeMs || source.status === 'failure' || !source.lastUpdated;

            console.log(`🔍 Freshness Check [${source.name}]:
            - CacheDuration: ${durationHours}h
            - LastUpdated: ${lastUpdated ? new Date(lastUpdated).toISOString() : 'Never'}
            - CurrentAge: ${(currentAge / 1000).toFixed(1)}s
            - Threshold: ${(maxAgeMs / 1000).toFixed(1)}s
            - IsStale: ${isStale}`);

            if (isStale) {
                staleSources.push(source.name);
            }
        }

        if (staleSources.length > 0) {
            console.log(`🔄 Found ${staleSources.length} stale sources: ${staleSources.join(', ')}. Triggering refresh...`);
            const { refreshSingleUpstreamSource } = await import('@/lib/analysis');

            // Refresh stale sources in parallel
            await Promise.all(staleSources.map(async (sourceName) => {
                const source = upstreamSources.find(s => s.name === sourceName);
                if (source) {
                    await refreshSingleUpstreamSource(sourceName, source.url);
                }
            }));

            // If we successfully triggered refresh (even if some failed, they log errors themselves),
            // we should assume new data might be available or attempted.
            // We clear current subscription result cache to force a rebuild logic to run
            await db.deleteCache(cacheKey);
        }
    } catch (e) {
        console.error('Error during upstream freshness check:', e);
        // Continue to serve whatever we have or try to build
    }

    // 6. Check cache with subscription-specific cache key and duration
    // Note: We check this AFTER validity check. If validity check caused a refresh, cache would be missing.
    let cachedYaml = await db.getCache(cacheKey);

    if (cachedYaml) {
        console.log(`✅ Serving cached subscription for token: ${token}`);
        await logAccess(200);
        return new NextResponse(cachedYaml, {
            headers: {
                'Content-Type': 'text/yaml; charset=utf-8',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(sub.username)}_${token}.yaml"`,
                'Subscription-Userinfo': `upload=0; download=0; total=10737418240; expire=0`,
                'X-Cache': 'HIT',
            },
        });
    }

    // 6. Build subscription YAML from structured database data
    try {
        const finalYaml = await buildSubscriptionYaml(sub);

        // Cache the built YAML with NO expiration (infinite).
        // It will only be invalidated if:
        // 1. Subscription is edited (sub-actions.ts)
        // 2. Upstream source is updated (analysis.ts)
        await db.setCache(cacheKey, finalYaml);

        console.log(`✅ Built and cached subscription for token: ${token}, cache duration: ${cacheDuration}h`);

        // Return YAML
        await logAccess(200);
        return new NextResponse(finalYaml, {
            headers: {
                'Content-Type': 'text/yaml; charset=utf-8',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(sub.username)}_${token}.yaml"`,
                'Subscription-Userinfo': `upload=0; download=0; total=10737418240; expire=0`,
                'X-Cache': 'MISS',
            },
        });
    } catch (error) {
        console.error('Failed to build subscription:', error);
        await logAccess(500);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
