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
    let upstreamCache = await db.getCache('cache:subscription');

    if (!upstreamCache) {
        const { refreshUpstreamCache } = await import('@/lib/analysis');
        const success = await refreshUpstreamCache();

        if (!success) {
            await logAccess(502);
            return new NextResponse('Failed to fetch upstream subscription', { status: 502 });
        }
    }

    // 6. Build subscription YAML from structured database data
    try {
        const finalYaml = await buildSubscriptionYaml(sub);

        // Cache the built YAML with subscription-specific duration (in hours)
        const cacheExpireMs = cacheDuration * 60 * 60 * 1000; // Convert hours to milliseconds
        await db.setCache(cacheKey, finalYaml, Date.now() + cacheExpireMs);

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
