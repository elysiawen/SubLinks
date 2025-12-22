import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import yaml from 'js-yaml';

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
        const { refreshUpstreamCache } = await import('@/lib/analysis');
        const success = await refreshUpstreamCache();

        if (success) {
            content = await redis.get('cache:subscription');
        } else {
            return new NextResponse('Failed to fetch upstream subscription', { status: 502 });
        }
    }

    // 5. Merge Strategy (Custom Groups / Rules)
    try {
        const doc = yaml.load(content as string) as any;

        // Handle Groups
        if (sub.groupId && sub.groupId !== 'default') {
            const groupSetStr = await redis.get(`custom:groups:${sub.groupId}`);
            if (groupSetStr) {
                const groupSet = JSON.parse(groupSetStr);
                // Parse the YAML content of the custom set
                const customGroups = yaml.load(groupSet.content);
                if (Array.isArray(customGroups)) {
                    doc['proxy-groups'] = customGroups;
                }
            }
        }

        // Handle Rules
        if (sub.ruleId && sub.ruleId !== 'default') {
            const ruleSetStr = await redis.get(`custom:rules:${sub.ruleId}`);
            if (ruleSetStr) {
                const ruleSet = JSON.parse(ruleSetStr);
                const customRules = yaml.load(ruleSet.content);
                if (Array.isArray(customRules)) {
                    doc.rules = customRules;
                }
            }
        }

        // Handle Subscription-specific Custom Rules Append
        if (sub.customRules) {
            const extraRules = sub.customRules.split('\n').map((line: string) => line.trim()).filter((line: string) => line && !line.startsWith('#'));
            if (doc.rules && Array.isArray(doc.rules)) {
                doc.rules.push(...extraRules);
            } else {
                doc.rules = extraRules;
            }
        }

        const finalYaml = yaml.dump(doc);

        // Generate profile name: username_token
        const profileName = `${sub.username}_${token}`;

        return new NextResponse(finalYaml, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(profileName)}.yaml"`,
                'Profile-Title': profileName,
                'Subscription-Userinfo': 'upload=0; download=0; total=10737418240000000; expire=0',
                'Profile-Update-Interval': '24'
            }
        });

    } catch (e) {
        console.error('YAML Merge Error:', e);
        // Fallback to raw append if parsing fails
        let finalContent = content || '';
        if (sub.customRules) {
            finalContent += `\n${sub.customRules}`;
        }
        return new NextResponse(finalContent, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            }
        });
    }
}
