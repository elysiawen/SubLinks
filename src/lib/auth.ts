import { db } from './db';
import { nanoid } from 'nanoid';
import { SignJWT, jwtVerify } from 'jose';

// Use simple session ID instead of JWT for simplicity with Redis
// or use JWT stateless. Redis is cleaner for revocation (blocking users).

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

export async function createSession(username: string, role: string) {
    const sessionId = nanoid(32);
    // Get user to obtain userId
    const user = await db.getUser(username);
    if (!user) {
        throw new Error('User not found');
    }
    await db.createSession(sessionId, {
        userId: user.id,
        username,
        role,
        tokenVersion: user.tokenVersion || 0,
        nickname: user.nickname
    }, SESSION_TTL);
    return sessionId;
}

export async function getSession(sessionId: string) {
    const session = await db.getSession(sessionId);
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
    if (session.nickname !== user.nickname) {
        await db.createSession(sessionId, {
            userId: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
            nickname: user.nickname
        }, SESSION_TTL);
        // Update the session object to return the latest nickname
        session.nickname = user.nickname;
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

