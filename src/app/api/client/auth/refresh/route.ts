import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, createAccessToken } from '@/lib/jwt-client';
import { getFullAvatarUrl } from '@/lib/utils';

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
                { error: 'Refresh token is required' },
                { status: 400 }
            );
        }

        // Verify refresh token
        const payload = await verifyToken(refreshToken);
        if (!payload) {
            return NextResponse.json(
                { error: 'Invalid or expired refresh token' },
                { status: 401 }
            );
        }

        // Verify token exists in DB (Check for revocation)
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const ua = request.headers.get('user-agent') || 'unknown';

        const storedToken = await db.getRefreshToken(refreshToken, ip, ua);
        if (!storedToken) {
            return NextResponse.json(
                { error: 'Session revoked or expired' },
                { status: 401 }
            );
        }

        // IP/UA/LastActive are now updated by getRefreshToken if changed


        // Create new access token with full avatar URL
        const fullAvatarUrl = getFullAvatarUrl(payload.avatar);
        const newAccessToken = await createAccessToken({
            userId: payload.userId,
            username: payload.username,
            role: payload.role,
            tokenVersion: payload.tokenVersion,
            nickname: payload.nickname,
            avatar: fullAvatarUrl,
        });

        return NextResponse.json({
            success: true,
            accessToken: newAccessToken,
            expiresIn: 60 * 60, // 1 hour
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
