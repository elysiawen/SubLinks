'use server';

import { db } from '@/lib/db';
import { getCurrentSession } from '@/lib/user-actions';
import { Session, RefreshToken } from '@/lib/database/interface';
import { cookies } from 'next/headers';

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

    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get('auth_session')?.value;

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
        current: s.sessionId === currentSessionId,
        loginMethod: s.loginMethod
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

    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get('auth_session')?.value;

    if (type === 'web' && sessionId === currentSessionId) {
        return { success: false, revoked: false, message: '无法注销当前正在使用的管理会话' };
    }

    let success = false;
    if (type === 'web') {
        success = await db.deleteSession(sessionId);
    } else {
        success = await db.deleteRefreshTokenById(sessionId);
    }

    return { 
        success: true, 
        revoked: success,
        message: success ? '会话已强制下线' : '该会话已失效或不存在'
    };
}
