'use server'

import { db } from '@/lib/db';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { createClientTokensForUser } from '@/lib/device-auth-helpers';

export async function getDeviceCodeInfo(deviceCode: string) {
    if (!deviceCode) return { error: 'missingDeviceCode' };

    const cacheData = await db.getCache(`device:${deviceCode}`);
    if (!cacheData) return { error: 'expired' };

    try {
        const data = JSON.parse(cacheData);
        if (data.status !== 'pending' || Date.now() > data.expiresAt) {
            return { error: 'expired' };
        }

        // Get browser IP for comparison
        const headersList = await headers();
        const browserIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
            || headersList.get('x-real-ip')
            || 'unknown';
        const clientIp = data.clientIp || 'unknown';

        // Normalize IPs for comparison (strip IPv6 prefix)
        const normalizeIp = (ip: string) => ip.replace(/^::ffff:/, '');
        const ipMismatch = clientIp !== 'unknown'
            && browserIp !== 'unknown'
            && normalizeIp(clientIp) !== normalizeIp(browserIp);

        // Get current user info from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('auth_session')?.value;
        let currentUser: { username: string; nickname?: string; avatar?: string } | null = null;
        if (sessionId) {
            const session = await getSession(sessionId);
            if (session) {
                currentUser = {
                    username: session.username,
                    nickname: session.nickname,
                    avatar: session.avatar,
                };
            }
        }

        return {
            success: true,
            clientDeviceInfo: data.clientDeviceInfo || null,
            clientIp,
            clientUa: data.clientUa || null,
            browserIp,
            ipMismatch,
            currentUser,
        };
    } catch {
        return { error: 'expired' };
    }
}

export async function confirmDeviceAuthorization(deviceCode: string): Promise<{ success?: boolean; error?: string }> {
    if (!deviceCode) return { error: 'missingDeviceCode' };

    // Check session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return { error: 'notLoggedIn' };

    const session = await getSession(sessionId);
    if (!session) return { error: 'notLoggedIn' };

    const user = await db.getUserById(session.userId);
    if (!user || user.status !== 'active') return { error: 'accountDisabled' };

    // Validate device code
    const cacheData = await db.getCache(`device:${deviceCode}`);
    if (!cacheData) return { error: 'expired' };

    let deviceData;
    try {
        deviceData = JSON.parse(cacheData);
    } catch {
        return { error: 'expired' };
    }
    if (deviceData.status !== 'pending' || Date.now() > deviceData.expiresAt) {
        return { error: 'expired' };
    }

    // Create tokens using client app's info
    const tokens = await createClientTokensForUser(
        user,
        deviceData.clientIp || 'unknown',
        deviceData.clientUa || 'unknown',
        deviceData.clientDeviceInfo,
        'device'
    );

    await db.setCache(`device:${deviceCode}`, JSON.stringify({
        status: 'authenticated',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: tokens.user,
    }), 300);

    return { success: true };
}

export async function denyDeviceAuthorization(deviceCode: string): Promise<{ success?: boolean; error?: string }> {
    if (!deviceCode) return { error: 'missingDeviceCode' };

    const cacheData = await db.getCache(`device:${deviceCode}`);
    if (!cacheData) return { error: 'expired' };

    try {
        const data = JSON.parse(cacheData);
        if (data.status !== 'pending') return { error: 'invalidStatus' };
    } catch {
        return { error: 'expired' };
    }

    await db.setCache(`device:${deviceCode}`, JSON.stringify({
        status: 'denied',
        deniedAt: Date.now(),
    }), 300);

    return { success: true };
}

export async function switchAccount(deviceCode: string) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (sessionId) {
        await db.deleteSession(sessionId);
    }
    cookieStore.delete('auth_session');
    redirect(`/auth/login?callbackUrl=/auth/device-confirm?code=${encodeURIComponent(deviceCode)}`);
}
