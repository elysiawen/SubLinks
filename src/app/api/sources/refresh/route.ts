import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { refreshUpstreamSource } from '@/lib/config-actions';

// Helper to extract API key from request
function getApiKey(request: NextRequest): string | null {
    // Method 1: Bearer token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Method 2: URL parameter
    const urlKey = request.nextUrl.searchParams.get('key');
    if (urlKey) return urlKey;

    // Method 3: POST body (will be handled in main function)
    return null;
}

// Helper to parse source names from request
function getSourceNames(request: NextRequest, body: any): string[] | null {
    // Check URL parameters first
    const urlSourceName = request.nextUrl.searchParams.get('sourceName');
    const urlSourceNames = request.nextUrl.searchParams.get('sourceNames');

    // Check body parameters
    const bodySourceName = body?.sourceName;
    const bodySourceNames = body?.sourceNames;

    const names = new Set<string>();

    // Add single source name
    if (urlSourceName) names.add(urlSourceName);
    if (bodySourceName) names.add(bodySourceName);

    // Add multiple source names
    if (urlSourceNames) {
        urlSourceNames.split(',').map(s => s.trim()).forEach(name => names.add(name));
    }
    if (bodySourceNames) {
        const nameArray = Array.isArray(bodySourceNames)
            ? bodySourceNames
            : bodySourceNames.split(',').map((s: string) => s.trim());
        nameArray.forEach((name: string) => names.add(name));
    }

    return names.size > 0 ? Array.from(names) : null;
}

export async function GET(request: NextRequest) {
    return handleRefresh(request, null);
}

export async function POST(request: NextRequest) {
    let body = null;
    try {
        body = await request.json();
    } catch {
        // Body might be empty or invalid, that's okay
    }
    return handleRefresh(request, body);
}

async function handleRefresh(request: NextRequest, body: any) {
    try {
        // 1. Get and validate API key
        let apiKey = getApiKey(request);
        if (!apiKey && body?.key) {
            apiKey = body.key;
        }

        const config = await db.getGlobalConfig();
        if (!config.refreshApiKey) {
            return NextResponse.json(
                { error: 'Refresh API not configured. Please set an API key in settings.' },
                { status: 503 }
            );
        }

        if (!apiKey || apiKey !== config.refreshApiKey) {
            return NextResponse.json(
                { error: 'Invalid or missing API key' },
                { status: 401 }
            );
        }

        // 2. Get source names to refresh
        const sourceNames = getSourceNames(request, body);

        // 3. Get precache parameter
        const precacheParam = request.nextUrl.searchParams.get('precache') || body?.precache;
        const precache = precacheParam === 'true' || precacheParam === true;

        // 4. Fetch sources to refresh
        let sources;
        if (sourceNames && sourceNames.length > 0) {
            // Refresh specific sources
            sources = await Promise.all(
                sourceNames.map(name => db.getUpstreamSourceByName(name))
            );
            sources = sources.filter((s): s is import('@/lib/database/interface').UpstreamSource => s !== null);

            if (sources.length === 0) {
                return NextResponse.json(
                    { error: 'No valid sources found with the provided names' },
                    { status: 404 }
                );
            }
        } else {
            // Refresh all sources
            sources = await db.getUpstreamSources();

            if (sources.length === 0) {
                return NextResponse.json(
                    { error: 'No upstream sources configured' },
                    { status: 404 }
                );
            }
        }

        // 5. Refresh sources
        const refreshed: string[] = [];
        const failed: string[] = [];

        for (const source of sources) {
            try {
                await refreshUpstreamSource(source.name);
                refreshed.push(source.name);
            } catch (error) {
                console.error(`Failed to refresh source ${source.name}:`, error);
                failed.push(source.name);
            }
        }

        // 6. Clear subscription caches
        const allSubs = await db.getAllSubscriptions();
        const affectedSubs = allSubs.filter(sub =>
            sub.selectedSources?.some(s => refreshed.includes(s))
        );

        let cacheCleared = 0;
        for (const sub of affectedSubs) {
            await db.deleteCache(`cache:subscription:${sub.token}`);
            cacheCleared++;
        }

        // 7. Optional: Precache subscriptions
        let precached = 0;
        if (precache && affectedSubs.length > 0) {
            const baseUrl = request.nextUrl.origin;

            // Trigger precaching (fire and forget)
            for (const sub of affectedSubs) {
                // Pass a special header to identify this as an internal system request
                fetch(`${baseUrl}/api/s/${sub.token}`, {
                    headers: {
                        'X-Internal-System-Precache': 'true'
                    }
                })
                    .then(() => precached++)
                    .catch(() => { });
            }
        }

        // 8. Return response
        return NextResponse.json({
            success: true,
            message: `已刷新 ${refreshed.length} 个上游源`,
            refreshed,
            failed: failed.length > 0 ? failed : undefined,
            cacheCleared,
            precached: precache ? affectedSubs.length : 0
        });

    } catch (error) {
        console.error('Refresh API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
