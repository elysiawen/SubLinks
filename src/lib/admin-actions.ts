'use server';

import { db } from '@/lib/db';
import { getCurrentSession } from '@/lib/user-actions';
import { Session, RefreshToken } from '@/lib/database/interface';

export async function checkAdmin() {
    const session = await getCurrentSession();
    if (!session || session.role !== 'admin') {
        throw new Error('Unauthorized');
    }
    return session;
}

export async function getAllSessionsList(page: number = 1, limit: number = 20, search?: string) {
    await checkAdmin();

    const [sessionsResult, tokensResult] = await Promise.all([
        db.getAllSessions(page, limit, search),
        db.getAllRefreshTokens(page, limit, search)
    ]);

    // Normalize Web Sessions
    const webSessions = sessionsResult.data.map(s => ({
        id: s.sessionId,
        type: 'web' as const,
        userId: s.userId,
        username: s.username,
        nickname: s.nickname || s.username,
        ip: s.ip || 'unknown',
        ipLocation: s.ipLocation,
        isp: s.isp,
        ua: s.ua || 'unknown',
        deviceInfo: s.deviceInfo || 'Web Browser',
        lastActive: s.lastActive || 0,
        current: false // Handled by client-side if needed
    }));

    // Normalize Client Sessions
    const clientSessions = tokensResult.data.map(s => ({
        id: s.id,
        type: 'client' as const,
        userId: s.userId,
        username: s.username,
        nickname: s.username, // Might need to fetch user for nickname
        ip: s.ip || 'unknown',
        ipLocation: s.ipLocation,
        isp: s.isp,
        ua: s.ua || 'unknown',
        deviceInfo: s.deviceInfo || 'Client App',
        lastActive: s.lastActive || s.createdAt,
        current: false
    }));

    // Combine and sort by last active
    const allSessions = [...webSessions, ...clientSessions]
        .sort((a, b) => b.lastActive - a.lastActive);

    return {
        sessions: allSessions,
        total: sessionsResult.total + tokensResult.total
    };
}

export async function revokeAnySession(sessionId: string, type: 'web' | 'client') {
    await checkAdmin();

    if (type === 'web') {
        await db.deleteSession(sessionId);
    } else {
        await db.deleteRefreshTokenById(sessionId);
    }

    return { success: true };
}
