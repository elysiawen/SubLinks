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

    // 2. Get Global Config
    const config = await db.getGlobalConfig();
    const upstreamUrl = config.upstreamUrl;
    const upstreamSources = config.upstreamSources || [];

    if (!upstreamUrl && upstreamSources.length === 0) {
        await logAccess(500);
        return new NextResponse('Server Configuration Error: No Upstream URL Set', { status: 500 });
    }

    // 3. Calculate effective settings from selected sources
    let effectiveCacheDuration = config.cacheDuration || 24;
    let effectiveUaWhitelist = config.uaWhitelist || [];

    const selectedSourceNames = sub.selectedSources || [];

    // Enforce selection of at least one upstream source
    if (selectedSourceNames.length === 0) {
        console.warn(`[API] Subscription ${token} has no upstream sources selected.`);
        await logAccess(400);
        return new NextResponse('Configuration Error: No Upstream Sources Selected. Please edit the subscription to select at least one source.', { status: 400 });
    }

    if (selectedSourceNames.length > 0 && config.upstreamSources) {
        const selectedSources = config.upstreamSources.filter(s => selectedSourceNames.includes(s.name));

        // Use minimum cache duration from selected sources if available
        const sourceDurations = selectedSources.map(s => s.cacheDuration).filter(d => d !== undefined) as number[];
        if (sourceDurations.length > 0) {
            effectiveCacheDuration = Math.min(...sourceDurations);
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

    // 5. Check cache with subscription-specific cache key and duration
    const cacheDuration = effectiveCacheDuration;
    const cacheKey = `cache:subscription:${token}`;
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

    // 5. Ensure upstream data is cached and parsed
    // 5. Ensure upstream data is cached and parsed, and check freshness
    let upstreamCache = await db.getCache('cache:subscription');

    // Check freshness for each selected source individually
    const sourcesToCheck = config.upstreamSources && selectedSourceNames.length > 0
        ? config.upstreamSources.filter(s => selectedSourceNames.includes(s.name))
        : (config.upstreamSources || []);

    // If no specific sources selected (unlikely given previous logic), check all default

    const now = Date.now();
    const staleSources: string[] = [];

    for (const source of sourcesToCheck) {
        const durationHours = source.cacheDuration || config.cacheDuration || 24;
        const maxAgeMs = durationHours * 60 * 60 * 1000;
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
            const source = config.upstreamSources?.find(s => s.name === sourceName);
            if (source) {
                await refreshSingleUpstreamSource(sourceName, source.url);
            }
        }));

        // Refresh succeeded (or tried to), get the new cache
        upstreamCache = await db.getCache('cache:subscription');
    }

    // 6. Build subscription YAML from structured database data
    try {
        const finalYaml = await buildSubscriptionYaml(sub);

        // Cache the built YAML with subscription-specific duration (in hours)
        const cacheExpireSeconds = Math.floor(cacheDuration * 60 * 60); // Convert hours to seconds
        await db.setCache(cacheKey, finalYaml, cacheExpireSeconds);

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
