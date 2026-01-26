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

        // Try to get username if logged in
        let username = undefined;
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('auth_session')?.value;
        if (sessionId) {
            // We need a way to get session, assuming db.getSession or similar available
            const session = await db.getSession(sessionId);
            if (session) username = session.username;
        }

        await db.createWebAccessLog({
            path,
            ip,
            ua,
            username,
            status: 200, // Client side navigation assumed successful if this runs
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

    // Get all logs and filter by username
    // Using search to optimize but still filtering for security and exact match
    const result = await db.getAPIAccessLogs(100, 0, user.username);
    const userLogs = result.data
        .filter(log => log.username === user.username)
        .slice(0, limit);

    return userLogs;
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

    // Get recent logs efficiently
    const result = await db.getAPIAccessLogs(1000, 0, user.username);
    const count = result.data.filter(log =>
        log.username === user.username &&
        log.timestamp >= twentyFourHoursAgo
    ).length;

    return count;
}

// User Subscription Logs (Full Page)
export async function getUserSubscriptionLogs(page: number = 1, pageSize: number = 20): Promise<{ logs: APIAccessLog[], total: number }> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) return { logs: [], total: 0 };
    const user = await getSession(sessionId);
    if (!user) return { logs: [], total: 0 };

    // Fetch more to handle filtering, since DB search is fuzzy
    // Note: This is an approximation. Ideally DB should support exact username filtering.
    // For now, we fetch a larger buffer.
    const bufferMultiplier = 5;
    const fetchLimit = pageSize * bufferMultiplier;
    const offset = (page - 1) * pageSize; // This offset is for the DB query, but since we filter, it's tricky.

    // Strategy: Fetch a large batch sorted by time, then filter in memory. 
    // This is not scalable for huge datasets but suffices for per-user logs typically.
    // Better approach: Fetch with search=username.

    const result = await db.getAPIAccessLogs(1000, 0, user.username);
    const filtered = result.data.filter(log => log.username === user.username);

    const total = filtered.length; // Approximate total based on fetched limit
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return { logs: paginated, total };
}

// User Web Access Logs (Full Page)
export async function getUserWebAccessLogs(page: number = 1, pageSize: number = 20): Promise<{ logs: WebAccessLog[], total: number }> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) return { logs: [], total: 0 };
    const user = await getSession(sessionId);
    if (!user) return { logs: [], total: 0 };

    const result = await db.getWebAccessLogs(1000, 0, user.username);
    const filtered = result.data.filter(log => log.username === user.username);

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return { logs: paginated, total };
}
