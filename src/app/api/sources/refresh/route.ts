import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { refreshUpstreamSource } from '@/lib/config-actions';

export const maxDuration = 60;

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
    const startTime = Date.now();
    let authMethod = '';

    try {
        // 1. Get and validate API key
        let apiKey: string | null = null;

        // Detect authentication method
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            authMethod = 'Bearer';
            apiKey = authHeader.substring(7);
        } else if (request.nextUrl.searchParams.get('key')) {
            authMethod = 'URL Param';
            apiKey = request.nextUrl.searchParams.get('key');
        } else if (body?.key) {
            authMethod = 'POST Body';
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
            // Log failed auth attempt
            try {
                const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
                const ua = request.headers.get('user-agent') || 'Unknown';
                await db.createAPIAccessLog({
                    token: apiKey || 'missing',
                    username: 'refresh-api',
                    ip,
                    ua,
                    status: 401,
                    timestamp: Date.now(),
                    apiType: '刷新API请求',
                    requestMethod: authMethod ? `${request.method} (${authMethod})` : request.method
                });
            } catch (e) {
                console.error('Failed to log API access:', e);
            }

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
            sources = sources.filter(s => s !== null) as import('@/lib/database/interface').UpstreamSource[];

            if (sources.length === 0) {
                return NextResponse.json(
                    { error: `No valid sources found for names: ${sourceNames.join(', ')}` },
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
        const failed: Array<{ name: string; error: string }> = [];

        for (const source of sources) {
            try {
                await refreshUpstreamSource(source.name, {
                    reason: authMethod ? `API Request (${authMethod})` : 'API Request',
                    trigger: 'api'
                });
                refreshed.push(source.name);
            } catch (error: any) {
                console.error(`Failed to refresh source ${source.name}:`, error);
                failed.push({
                    name: source.name,
                    error: error.message || 'Unknown error'
                });
            }
        }

        // 6. Clear subscription cache for affected sources
        const cacheCleared = await db.clearAllSubscriptionCaches();

        // Get affected subscriptions for precaching
        const allSubs = await db.getAllSubscriptions();
        const affectedSubs = allSubs.filter(sub => {
            const selectedSources = sub.selectedSources || [];
            return sources.some(source => selectedSources.includes(source.name));
        });

        // 7. Optional: Precache subscriptions
        let precacheResults = { success: 0, failed: 0 };
        if (precache && affectedSubs.length > 0) {
            const baseUrl = process.env.NEXT_PUBLIC_URL || request.nextUrl.origin;
            console.log(`Starting precache for ${affectedSubs.length} subscriptions using base URL: ${baseUrl}`);

            // Create an array of promises
            const precachePromises = affectedSubs.map(sub =>
                fetch(`${baseUrl}/api/s/${sub.token}`, {
                    headers: {
                        'X-Internal-System-Precache': 'true'
                    }
                })
                    .then(res => {
                        if (res.ok) return { success: true };
                        throw new Error(`Status ${res.status}`);
                    })
                    .catch(err => ({ success: false, error: err }))
            );

            // Wait for all to complete
            const results = await Promise.allSettled(precachePromises);

            results.forEach(result => {
                if (result.status === 'fulfilled' && (result.value as any).success) {
                    precacheResults.success++;
                } else {
                    precacheResults.failed++;
                    if (result.status === 'fulfilled') {
                        console.error('Precache failed:', (result.value as any).error);
                    } else {
                        console.error('Precache promise rejected:', result.reason);
                    }
                }
            });

            console.log(`Precache completed: ${precacheResults.success} success, ${precacheResults.failed} failed`);
        }

        // 8. Log successful API access
        try {
            const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
            const ua = request.headers.get('user-agent') || 'Unknown';
            await db.createAPIAccessLog({
                token: apiKey,
                username: 'refresh-api',
                ip,
                ua,
                status: 200,
                timestamp: Date.now(),
                apiType: '刷新API请求',
                requestMethod: authMethod ? `${request.method} (${authMethod})` : request.method
            });
        } catch (e) {
            console.error('Failed to log API access:', e);
        }

        // 9. Return response
        const hasFailures = failed.length > 0;
        const allFailed = failed.length === sources.length;

        return NextResponse.json({
            success: !allFailed,
            partialSuccess: hasFailures && !allFailed,
            message: allFailed
                ? `所有上游源刷新失败`
                : hasFailures
                    ? `已刷新 ${refreshed.length} 个上游源，${failed.length} 个失败`
                    : `已刷新 ${refreshed.length} 个上游源`,
            refreshed,
            failed: hasFailures ? failed : undefined,
            cacheCleared,
            precached: precache ? affectedSubs.length : 0
        }, {
            status: allFailed ? 500 : 200
        });

    } catch (error) {
        console.error('Refresh API error:', error);

        // Log error
        try {
            const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
            const ua = request.headers.get('user-agent') || 'Unknown';
            await db.createAPIAccessLog({
                token: 'error',
                username: 'refresh-api',
                ip,
                ua,
                status: 500,
                timestamp: Date.now(),
                apiType: '刷新API请求',
                requestMethod: authMethod ? `${request.method} (${authMethod})` : request.method
            });
        } catch (e) {
            console.error('Failed to log API access:', e);
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
