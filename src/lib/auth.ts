import { redis } from './redis';
import { nanoid } from 'nanoid';
import { SignJWT, jwtVerify } from 'jose';

// Use simple session ID instead of JWT for simplicity with Redis
// or use JWT stateless. Redis is cleaner for revocation (blocking users).

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

export async function createSession(username: string, role: string) {
    const sessionId = nanoid(32);
    const sessionData = { username, role, createdAt: Date.now() };
    await redis.set(`session:${sessionId}`, JSON.stringify(sessionData), 'EX', SESSION_TTL);
    return sessionId;
}

export async function getSession(sessionId: string) {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
}

export async function destroySession(sessionId: string) {
    await redis.del(`session:${sessionId}`);
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
