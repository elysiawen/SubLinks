'use server';

import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { getSession } from '@/lib/auth'; // Ensure this exists or use cookies
import { cookies } from 'next/headers';

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
