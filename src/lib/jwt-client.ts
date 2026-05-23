import { SignJWT, jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
    throw new Error(
        '[FATAL] JWT_SECRET environment variable is not set. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour (Reduced for better session control)
const REFRESH_TOKEN_TTL = 365 * 24 * 60 * 60; // 1 year

export interface TokenPayload {
    userId: string;
    tokenVersion?: string;
    refreshTokenId?: string; // DB ID of the device's refresh token, for device-level session validation
}

/**
 * Create JWT access token for client authentication
 * Only stores userId, tokenVersion, refreshTokenId — user info fetched from DB on demand
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
 * Returns only userId, tokenVersion, refreshTokenId — call db.getUserById() for full user info
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const tokenPayload: TokenPayload = {
            userId: payload.userId as string,
            tokenVersion: payload.tokenVersion as string | undefined,
            refreshTokenId: payload.refreshTokenId as string | undefined,
        };

        // Verify token version to invalidate tokens after password change
        const { db } = await import('@/lib/db');
        const user = await db.getUserById(tokenPayload.userId);
        if (!user) {
            return null;
        }

        // Check if account is banned or disabled
        if (user.status !== 'active') {
            return null;
        }

        const tokenVersion = tokenPayload.tokenVersion || '';
        const currentVersion = user.tokenVersion || '';

        if (tokenVersion !== currentVersion) {
            // Token version mismatch, token is invalid
            return null;
        }

        return tokenPayload;
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
