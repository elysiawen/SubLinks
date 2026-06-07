import { db } from './db';
import { createAccessToken, createRefreshToken } from './jwt-client';
import { getFullAvatarUrl } from './utils';
import { nanoid } from 'nanoid';

const REFRESH_TTL_SEC = 365 * 24 * 60 * 60; // 1 year

/**
 * Create JWT access + refresh tokens for a user and store refresh token in DB.
 * Shared by client login route and device auth flow.
 */
export async function createClientTokensForUser(
    user: {
        id: string;
        username: string;
        role: string;
        nickname?: string;
        avatar?: string | null;
        tokenVersion?: string;
    },
    ip: string,
    ua: string,
    deviceInfo?: string,
    loginMethod?: string
): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        username: string;
        role: string;
        nickname?: string;
        avatar?: string | undefined;
    };
}> {
    const refreshTokenDbId = nanoid(32);
    const tokenVersion = user.tokenVersion || nanoid(16);

    const refreshToken = await createRefreshToken({
        userId: user.id,
        tokenVersion,
    });

    const accessToken = await createAccessToken({
        userId: user.id,
        tokenVersion,
        refreshTokenId: refreshTokenDbId,
    });

    // Store refresh token in DB
    try {
        await db.createRefreshToken({
            id: refreshTokenDbId,
            userId: user.id,
            username: user.username,
            token: refreshToken,
            ip,
            ua,
            deviceInfo: deviceInfo || ua,
            loginMethod: loginMethod || undefined,
            createdAt: Date.now(),
            expiresAt: Date.now() + REFRESH_TTL_SEC * 1000,
            lastActive: Date.now(),
        });
    } catch (e) {
        console.error('Failed to store refresh token:', e);
    }

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            nickname: user.nickname,
            avatar: getFullAvatarUrl(user.avatar) || user.avatar || undefined,
        },
    };
}
