import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// Runtime must be nodejs for ioredis
export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    // 1. Get Subscription (New Schema)
    const subStr = await redis.get(`sub:${token}`);
    const sub = subStr ? JSON.parse(subStr) : null;

    if (!sub || sub.enabled === false) {
        return new NextResponse('Invalid Subscription Token. Please contact admin.', { status: 403 });
    }

    // Check User Status (Owner)
    const userStr = await redis.get(`user:${sub.username}`);
    const user = userStr ? JSON.parse(userStr) : null;
    if (!user || user.status !== 'active') {
        return new NextResponse('User Account Suspended', { status: 403 });
    }

    // 2. Get Global Config
    const configStr = await redis.get('config:global');
    const config = configStr ? JSON.parse(configStr) : {};

    const upstreamUrl = config.upstreamUrl;
    const cacheDuration = (config.cacheDuration || 24) * 3600; // seconds

    if (!upstreamUrl) {
        return new NextResponse('Server Configuration Error: No Upstream URL Set', { status: 500 });
    }

    // 3. User Agent Check (Strict Mode from Global Config)
    if (config.uaWhitelist && Array.isArray(config.uaWhitelist) && config.uaWhitelist.length > 0) {
        const ua = request.headers.get('user-agent') || '';
        const allowed = config.uaWhitelist.some((w: string) => ua.includes(w));
        if (!allowed) {
            return new NextResponse('Client Not Allowed', { status: 403 });
        }
    }

    // 4. Cache Strategy
    let content = await redis.get('cache:subscription');

    if (!content) {
        try {
            const res = await fetch(upstreamUrl, {
                headers: {
                    'User-Agent': 'Clash/Vercel-Sub-Manager'
                }
            });
            if (!res.ok) {
                console.error(`Upstream Fetch Failed: ${res.status} ${res.statusText} for URL: ${upstreamUrl}`);
                throw new Error(`Upstream error: ${res.status} ${res.statusText}`);
            }
            content = await res.text();
            // Set Cache
            await redis.set('cache:subscription', content, 'EX', cacheDuration);
        } catch (e) {
            console.error(e);
            return new NextResponse('Failed to fetch upstream subscription', { status: 502 });
        }
    }

    // 5. Apply User Rules (from Subscription)
    let finalContent = content || '';
    if (sub.customRules) {
        finalContent += `\n${sub.customRules}`;
    }

    return new NextResponse(finalContent, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Subscription-Userinfo': 'upload=0; download=0; total=10737418240000000; expire=0',
        }
    });
}
