'use server'

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';

async function verifyAdmin() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return false;

    const session = await getSession(sessionId);
    return session?.role === 'admin';
}

export async function getAPILogs(page: number = 1, limit: number = 50, search?: string) {
    if (!await verifyAdmin()) return { error: 'Unauthorized' };

    const offset = (page - 1) * limit;
    const logs = await db.getAPIAccessLogs(limit, offset, search);
    return { logs };
}

export async function getWebLogs(page: number = 1, limit: number = 50, search?: string) {
    if (!await verifyAdmin()) return { error: 'Unauthorized' };

    const offset = (page - 1) * limit;
    const logs = await db.getWebAccessLogs(limit, offset, search);
    return { logs };
}

export async function getSystemLogs(page: number = 1, limit: number = 50, search?: string) {
    if (!await verifyAdmin()) return { error: 'Unauthorized' };

    const offset = (page - 1) * limit;
    const logs = await db.getSystemLogs(limit, offset, search);
    return { logs };
}
