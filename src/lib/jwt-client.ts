import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const ACCESS_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
const REFRESH_TOKEN_TTL = 365 * 24 * 60 * 60; // 1 year

export interface TokenPayload {
    userId: string;
    username: string;
    role: string;
    tokenVersion?: number;
    nickname?: string;
    avatar?: string;
}

/**
 * Create JWT access token for client authentication
 */
export async function createAccessToken(payload: TokenPayload): Promise<string> {
    const token = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL)
        .sign(JWT_SECRET);

    return token;
}

/**
 * Create JWT refresh token for client authentication
 */
export async function createRefreshToken(payload: TokenPayload): Promise<string> {
    const token = await new SignJWT({ ...payload, type: 'refresh' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL)
        .sign(JWT_SECRET);

    return token;
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const tokenPayload: TokenPayload = {
            userId: payload.userId as string,
            username: payload.username as string,
            role: payload.role as string,
            tokenVersion: payload.tokenVersion as number | undefined,
            nickname: payload.nickname as string | undefined,
            avatar: payload.avatar as string | undefined,
        };

        // Verify token version to invalidate tokens after password change
        const { db } = await import('@/lib/db');
        const user = await db.getUser(tokenPayload.username);
        if (!user) {
            return null;
        }

        // Check if account is banned or disabled
        if (user.status !== 'active') {
            return null;
        }

        const tokenVersion = tokenPayload.tokenVersion || 0;
        const currentVersion = user.tokenVersion || 0;

        if (tokenVersion !== currentVersion) {
            // Token version mismatch, token is invalid
            return null;
        }

        // Return payload with latest user info (nickname/avatar) from DB
        return {
            ...tokenPayload,
            nickname: user.nickname,
            avatar: user.avatar
        };
    } catch (error) {
        // Log validation failures gracefully without stack trace
        if (error instanceof Error) {
            console.warn('[JWT] Token validation failed:', error.message);
        } else {
            console.warn('[JWT] Token validation failed: Unknown error');
        }
        return null;
    }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}
