'use server';

import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { getSession } from '@/lib/auth'; // Ensure this exists or use cookies
import { cookies } from 'next/headers';
import type { APIAccessLog, WebAccessLog } from './database/interface';

export async function logWebAccess(path: string) {
    try {
        const headerList = await headers();
        const ip = headerList.get('cf-connecting-ip') || headerList.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
        const ua = headerList.get('user-agent') || 'Unknown';

        // Try to get user info if logged in
        let username = undefined;
        let userId = undefined;
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('auth_session')?.value;
        if (sessionId) {
            const session = await db.getSession(sessionId);
            if (session) {
                username = session.username;
                userId = session.userId;
            }
        }

        await db.createWebAccessLog({
            path,
            ip,
            ua,
            username,
            userId,
            status: 200,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error('Failed to log web access:', e);
    }
}

export async function getUserAccessLogs(limit: number = 3) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        return [];
    }

    const user = await getSession(sessionId);
    if (!user) {
        return [];
    }

    const result = await db.getAPIAccessLogs(limit, 0, undefined, user.userId);
    return result.data;
}

export async function getUserApiCount24h() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        return 0;
    }

    const user = await getSession(sessionId);
    if (!user) {
        return 0;
    }

    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

    const result = await db.getAPIAccessLogs(1000, 0, undefined, user.userId);
    const count = result.data.filter(log => log.timestamp >= twentyFourHoursAgo).length;

    return count;
}

// User Subscription Logs (Full Page)
export async function getUserSubscriptionLogs(page: number = 1, pageSize: number = 20): Promise<{ logs: APIAccessLog[], total: number }> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) return { logs: [], total: 0 };
    const user = await getSession(sessionId);
    if (!user) return { logs: [], total: 0 };

    const offset = (page - 1) * pageSize;
    const result = await db.getAPIAccessLogs(pageSize, offset, undefined, user.userId);

    return { logs: result.data, total: result.total };
}

// User Web Access Logs (Full Page)
export async function getUserWebAccessLogs(page: number = 1, pageSize: number = 20): Promise<{ logs: WebAccessLog[], total: number }> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) return { logs: [], total: 0 };
    const user = await getSession(sessionId);
    if (!user) return { logs: [], total: 0 };

    const offset = (page - 1) * pageSize;
    const result = await db.getWebAccessLogs(pageSize, offset, undefined, user.userId);

    return { logs: result.data, total: result.total };
}
