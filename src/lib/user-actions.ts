'use server';

import { db } from '@/lib/db';
import { getSession, verifyPassword, hashPassword } from '@/lib/auth';
import { Session, RefreshToken } from '@/lib/database/interface';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

async function refreshSession(updates: { nickname?: string; avatar?: string }) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return;
    const existingSession = await db.getSession(sessionId);
    if (!existingSession) return;
    const user = await db.getUser(existingSession.username);
    if (!user) return;
    await db.createSession(sessionId, {
        userId: user.id,
        username: user.username,
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
        nickname: updates.nickname ?? user.nickname,
        avatar: updates.avatar ?? user.avatar,
        loginMethod: existingSession?.loginMethod,
        ip: existingSession?.ip,
        ua: existingSession?.ua,
        deviceInfo: existingSession?.deviceInfo,
        lastActive: existingSession?.lastActive,
    }, 7 * 24 * 60 * 60);
}

export async function getCurrentSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;
    return await getSession(sessionId);
}

export async function setup2FA() {
    const session = await getCurrentSession();
    if (!session) return { error: 'notLoggedIn' };

    const secret = generateSecret();
    const otpauth = generateURI({
        secret,
        label: session.username,
        issuer: 'SubLinks'
    });

    try {
        const qrCode = await QRCode.toDataURL(otpauth);
        return { secret, qrCode };
    } catch (err) {
        console.error('QR Code generation failed:', err);
        return { error: 'qrGenerateFailed' };
    }
}

export async function enable2FA(secret: string, token: string) {
    const session = await getCurrentSession();
    if (!session) return { error: 'notLoggedIn' };

    // Verify the token with the provided secret (not saved yet)
    try {
        const result = await verify({ token, secret });
        if (!result?.valid) return { error: 'twoFactorInvalid' };
    } catch (err) {
        return { error: 'twoFactorInvalid' };
    }

    // Update user
    const user = await db.getUser(session.username);
    if (!user) return { error: 'userNotFound' };

    await db.setUser(session.username, {
        ...user,
        totpSecret: secret,
        totpEnabled: true
    });

    return { success: true };
}

export async function getCurrentUser() {
    const session = await getCurrentSession();
    if (!session) return null;
    return db.getUser(session.username); // Or return session user details if sufficient
}

export async function changePassword(oldPassword: string, newPassword: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'notLoggedIn' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: 'userNotFound' };
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.password);
    if (!isValid) {
        return { error: 'wrongOldPassword' };
    }

    // Validate new password
    if (!newPassword || newPassword.length < 4) {
        return { error: 'newPasswordTooShort' };
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
        return { error: 'notLoggedIn' };
    }

    if (session.role === 'admin') {
        return { error: 'adminCannotDelete' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: 'userNotFound' };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        return { error: 'passwordVerifyFailed' };
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
        return { error: 'notLoggedIn' };
    }

    // Validate nickname
    if (nickname && nickname.length > 50) {
        return { error: 'nicknameTooLong' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: 'userNotFound' };
    }

    // Update nickname in database
    await db.setUser(session.username, {
        ...user,
        nickname: nickname || undefined
    });

    await refreshSession({ nickname: nickname || undefined });

    return { success: true };
}

export async function uploadAvatar(formData: FormData) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'notLoggedIn' };
    }

    const file = formData.get('avatar') as File;
    if (!file) {
        return { error: 'noFileUploaded' };
    }

    // Check file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        return { error: 'fileTooLarge' };
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
        return { error: 'imageOnly' };
    }

    try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate and process image
        const { ImageProcessor } = await import('@/lib/image-processor');
        const isValid = await ImageProcessor.validateImage(buffer);
        if (!isValid) {
            return { error: 'invalidImage' };
        }

        // Process image (resize to 500x500, convert to WebP)
        const processedBuffer = await ImageProcessor.processAvatar(buffer, 500);

        // Get user
        const user = await db.getUser(session.username);
        if (!user) {
            return { error: 'userNotFound' };
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

        await refreshSession({ avatar: avatarUrl });

        return { success: true, avatarUrl };
    } catch (error) {
        console.error('Avatar upload error:', error);
        return { error: 'uploadFailed' };
    }
}

export async function deleteAvatar() {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'notLoggedIn' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: 'userNotFound' };
    }

    if (!user.avatar) {
        return { error: 'noAvatar' };
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

    await refreshSession({ avatar: undefined });

    return { success: true };
}

export async function getUserSessionsList(search?: string) {
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
    let sessions = [
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
                current: s.sessionId === currentSessionId,
                loginMethod: s.loginMethod
            })),
        ...clientSessions.map((s: RefreshToken) => ({
            id: s.id,
            type: 'client' as const,
            ip: s.ip || 'unknown',
            ipLocation: s.ipLocation,
            isp: s.isp,
            ua: s.ua || 'unknown',
            deviceInfo: s.deviceInfo || 'Client App',
            lastActive: s.lastActive || s.createdAt,
            current: false
        }))
    ];

    // Apply search filter if provided
    if (search) {
        const term = search.toLowerCase();
        sessions = sessions.filter(s => 
            s.ip.toLowerCase().includes(term) || 
            s.deviceInfo.toLowerCase().includes(term) || 
            s.ua.toLowerCase().includes(term) ||
            (s.ipLocation && s.ipLocation.toLowerCase().includes(term)) ||
            (s.isp && s.isp.toLowerCase().includes(term))
        );
    }

    // Sort: Current session first, then by last active
    sessions.sort((a, b) => {
        if (a.current) return -1;
        if (b.current) return 1;
        return b.lastActive - a.lastActive;
    });

    return { sessions };
}


export async function disable2FA(password: string) {
    const session = await getCurrentSession();
    if (!session) return { error: 'notLoggedIn' };

    const user = await db.getUser(session.username);
    if (!user) return { error: 'userNotFound' };

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        return { error: 'wrongPassword' };
    }

    // Disable 2FA
    await db.setUser(session.username, {
        ...user,
        totpEnabled: false,
        totpSecret: undefined
    });

    return { success: true };
}

export async function revokeSession(sessionId: string, type: 'web' | 'client') {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'Unauthorized' };
    }

    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get('auth_session')?.value;

    if (type === 'web' && sessionId === currentSessionId) {
        return { success: false, message: 'cannotOfflineCurrent' };
    }

    let success = false;
    if (type === 'web') {
        success = await db.deleteUserSession(session.userId, sessionId);
    } else {
        success = await db.deleteUserRefreshToken(session.userId, sessionId);
    }

    return { 
        success: true, // We still return success as true to indicate the request finished
        revoked: success, // But add a 'revoked' field for actual deletion status
        message: success ? 'forceOfflineIssued' : 'sessionNotFound'
    };
}
