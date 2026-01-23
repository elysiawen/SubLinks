'use server';

import { db } from '@/lib/db';
import { getSession, verifyPassword, hashPassword } from '@/lib/auth';
import { Session, RefreshToken } from '@/lib/database/interface';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function getCurrentSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;
    return await getSession(sessionId);
}

export async function getCurrentUser() {
    const session = await getCurrentSession();
    if (!session) return null;
    return db.getUser(session.username); // Or return session user details if sufficient
}

export async function changePassword(oldPassword: string, newPassword: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: '未登录' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: '用户不存在' };
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.password);
    if (!isValid) {
        return { error: '原密码错误' };
    }

    // Validate new password
    if (!newPassword || newPassword.length < 4) {
        return { error: '新密码至少需要4个字符' };
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    const newTokenVersion = (user.tokenVersion || 0) + 1;
    await db.setUser(session.username, {
        ...user,
        password: hashedPassword,
        tokenVersion: newTokenVersion
    });

    // Global Logout: delete all sessions and refresh tokens for this user
    await Promise.all([
        db.deleteAllUserSessions(user.id),
        db.deleteAllUserRefreshTokens(user.id)
    ]);

    // Logout current web session by deleting cookie (DB record already deleted above)
    const cookieStore = await cookies();
    cookieStore.delete('auth_session');

    return { success: true };
}

export async function deleteOwnAccount(password: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: '未登录' };
    }

    if (session.role === 'admin') {
        return { error: '管理员账号无法通过此方式删除，请联系技术支持' };
        // Protecting admin account from accidental self-deletion
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: '用户不存在' };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        return { error: '密码错误，验证失败' };
    }

    // Delete user
    await db.deleteUser(session.username);

    // Delete session (Logout)
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (sessionId) {
        await db.deleteSession(sessionId);
        cookieStore.delete('auth_session');
    }

    return { success: true };
}

export async function updateNickname(nickname: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: '未登录' };
    }

    // Validate nickname
    if (nickname && nickname.length > 50) {
        return { error: '昵称不能超过50个字符' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: '用户不存在' };
    }

    // Update nickname in database
    await db.setUser(session.username, {
        ...user,
        nickname: nickname || undefined
    });

    // Update current session with new nickname
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (sessionId) {
        await db.createSession(sessionId, {
            userId: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
            nickname: nickname || undefined,
            avatar: user.avatar
        }, 7 * 24 * 60 * 60); // 7 days
    }

    return { success: true };
}

export async function uploadAvatar(formData: FormData) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: '未登录' };
    }

    const file = formData.get('avatar') as File;
    if (!file) {
        return { error: '未上传文件' };
    }

    // Check file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        return { error: '文件大小不能超过 10MB' };
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
        return { error: '只支持图片文件' };
    }

    try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate and process image
        const { ImageProcessor } = await import('@/lib/image-processor');
        const isValid = await ImageProcessor.validateImage(buffer);
        if (!isValid) {
            return { error: '无效的图片文件' };
        }

        // Process image (resize to 500x500, convert to WebP)
        const processedBuffer = await ImageProcessor.processAvatar(buffer, 500);

        // Get user
        const user = await db.getUser(session.username);
        if (!user) {
            return { error: '用户不存在' };
        }

        // Delete old avatar if exists
        if (user.avatar) {
            try {
                const { StorageFactory } = await import('@/lib/storage');
                const storage = await StorageFactory.createFromGlobalConfig();
                await storage.delete(user.avatar);
            } catch (error) {
                console.warn('Failed to delete old avatar:', error);
            }
        }

        // Upload new avatar
        const { StorageFactory } = await import('@/lib/storage');
        const storage = await StorageFactory.createFromGlobalConfig();
        const avatarUrl = await storage.upload(
            processedBuffer,
            `${user.id}-${Date.now()}`,
            'image/webp'
        );

        // Update user avatar in database
        await db.setUser(session.username, {
            ...user,
            avatar: avatarUrl,
        });

        // Update session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('auth_session')?.value;
        if (sessionId) {
            await db.createSession(sessionId, {
                userId: user.id,
                username: user.username,
                role: user.role,
                tokenVersion: user.tokenVersion || 0,
                nickname: user.nickname,
                avatar: avatarUrl
            }, 7 * 24 * 60 * 60);
        }

        return { success: true, avatarUrl };
    } catch (error) {
        console.error('Avatar upload error:', error);
        return { error: '上传失败，请稍后重试' };
    }
}

export async function deleteAvatar() {
    const session = await getCurrentSession();
    if (!session) {
        return { error: '未登录' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: '用户不存在' };
    }

    if (!user.avatar) {
        return { error: '未设置头像' };
    }

    try {
        // Delete avatar from storage
        const { StorageFactory } = await import('@/lib/storage');
        const storage = await StorageFactory.createFromGlobalConfig();
        await storage.delete(user.avatar);
    } catch (error) {
        console.warn('Failed to delete avatar from storage:', error);
    }

    // Update user avatar in database
    await db.setUser(session.username, {
        ...user,
        avatar: undefined,
    });

    // Update session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (sessionId) {
        // Fetch existing session first to preserve metadata
        const existingSession = await db.getSession(sessionId);
        await db.createSession(sessionId, {
            userId: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
            nickname: user.nickname,
            avatar: undefined,
            // Preserve metadata
            ip: existingSession?.ip,
            ua: existingSession?.ua,
            deviceInfo: existingSession?.deviceInfo,
            lastActive: existingSession?.lastActive
        }, 7 * 24 * 60 * 60);
    }


    return { success: true };
}

export async function getUserSessionsList() {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'Unauthorized' };
    }

    const [webSessions, clientSessions] = await Promise.all([
        db.getUserSessions(session.userId),
        db.getUserRefreshTokens(session.userId)
    ]);

    const user = await db.getUser(session.username);
    const currentTokenVersion = user?.tokenVersion || 0;

    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get('auth_session')?.value;

    // Normalize and filter data
    const sessions = [
        ...webSessions
            .filter((s: Session) => (s.tokenVersion || 0) === currentTokenVersion)
            .map((s: Session & { sessionId?: string }) => ({
                id: s.sessionId || 'unknown',
                type: 'web' as const,
                ip: s.ip || 'unknown',
                ipLocation: s.ipLocation,
                isp: s.isp,
                ua: s.ua || 'unknown',
                deviceInfo: s.deviceInfo || 'Web Browser',
                lastActive: s.lastActive || 0,
                current: s.sessionId === currentSessionId
            })),
        ...clientSessions.map((s: RefreshToken) => ({
            id: s.id,
            type: 'client' as const,
            ip: s.ip || 'unknown',
            ua: s.ua || 'unknown',
            deviceInfo: s.deviceInfo || 'Client App',
            lastActive: s.lastActive || s.createdAt,
            current: false
        }))
    ];

    // Sort: Current session first, then by last active
    sessions.sort((a, b) => {
        if (a.current) return -1;
        if (b.current) return 1;
        return b.lastActive - a.lastActive;
    });

    return { sessions };
}

export async function revokeSession(sessionId: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'Unauthorized' };
    }

    await db.deleteUserSession(session.userId, sessionId);
    await db.deleteUserRefreshToken(session.userId, sessionId);

    return { success: true };
}
