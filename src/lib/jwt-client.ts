import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const ACCESS_TOKEN_TTL = 24 * 60 * 60; // 24 hours
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days

export interface TokenPayload {
    userId: string;
    username: string;
    role: string;
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
        return {
            userId: payload.userId as string,
            username: payload.username as string,
            role: payload.role as string,
        };
    } catch (error) {
        console.error('Token verification failed:', error);
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
