import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, createAccessToken } from '@/lib/jwt-client';
import { getFullAvatarUrl } from '@/lib/utils';
import { tApi } from '@/lib/api-i18n';

export const runtime = 'nodejs';

/**
 * Refresh Access Token API
 * POST /api/client/auth/refresh
 * Body: { refreshToken: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return NextResponse.json(
                { error: await tApi('auth.refreshTokenRequired') },
                { status: 400 }
            );
        }

        // Verify refresh token
        const payload = await verifyToken(refreshToken);
        if (!payload) {
            return NextResponse.json(
                { error: await tApi('auth.invalidRefreshToken') },
                { status: 401 }
            );
        }

        // Verify token exists in DB (Check for revocation)
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const ua = request.headers.get('user-agent') || 'unknown';

        const storedToken = await db.getRefreshToken(refreshToken, ip, ua);
        if (!storedToken) {
            return NextResponse.json(
                { error: await tApi('auth.sessionRevoked') },
                { status: 401 }
            );
        }

        // IP/UA/LastActive are now updated by getRefreshToken if changed

        // Fetch current user from DB to avoid stale JWT payload after rename
        const user = await db.getUserById(payload.userId);
        if (!user || user.status !== 'active') {
            return NextResponse.json(
                { error: await tApi('auth.invalidRefreshToken') },
                { status: 401 }
            );
        }

        // Create new access token — only userId + tokenVersion + refreshTokenId
        const newAccessToken = await createAccessToken({
            userId: user.id,
            tokenVersion: user.tokenVersion || '',
            refreshTokenId: storedToken.id,
        });

        return NextResponse.json({
            success: true,
            accessToken: newAccessToken,
            expiresIn: 60 * 60, // 1 hour
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        return NextResponse.json(
            { error: await tApi('auth.internalError') },
            { status: 500 }
        );
    }
}
