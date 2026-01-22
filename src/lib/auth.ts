import { db } from './db';
import { nanoid } from 'nanoid';
import { SignJWT, jwtVerify } from 'jose';

// Use simple session ID instead of JWT for simplicity.
// or use JWT stateless.

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

export async function createSession(username: string, role: string, ip?: string, ua?: string) {
    const sessionId = nanoid(32);
    // Get user to obtain userId
    const user = await db.getUser(username);
    if (!user) {
        throw new Error('User not found');
    }

    // Parse UA if present
    const deviceInfo = ua ? ua : undefined; // TODO: Parse with uap-node if needed later

    await db.createSession(sessionId, {
        userId: user.id,
        username,
        role,
        tokenVersion: user.tokenVersion || 0,
        nickname: user.nickname,
        avatar: user.avatar,
        ip,
        ua,
        deviceInfo
    }, SESSION_TTL);
    return sessionId;
}

export async function getSession(sessionId: string, currentIp?: string) {
    const session = await db.getSession(sessionId, currentIp);
    if (!session) {
        return null;
    }

    // Verify token version to invalidate sessions after password change
    const user = await db.getUser(session.username);
    if (!user) {
        return null;
    }

    // Check if account is banned or disabled
    if (user.status !== 'active') {
        await db.deleteSession(sessionId);
        return null;
    }

    const sessionVersion = session.tokenVersion || 0;
    const currentVersion = user.tokenVersion || 0;

    if (sessionVersion !== currentVersion) {
        // Token version mismatch, session is invalid
        await db.deleteSession(sessionId);
        return null;
    }

    // Update session nickname if it changed in database
    if (session.nickname !== user.nickname || session.avatar !== user.avatar) {
        await db.createSession(sessionId, {
            userId: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
            nickname: user.nickname,
            avatar: user.avatar
        }, SESSION_TTL);
        // Update the session object to return the latest data
        session.nickname = user.nickname;
        session.avatar = user.avatar;
    }

    return session;
}

export async function destroySession(sessionId: string) {
    await db.deleteSession(sessionId);
}

export async function hashPassword(password: string) {
    // Dynamically import bcryptjs to avoid edge runtime issues if any (though we stick to nodejs runtime)
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
}

