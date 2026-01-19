import { NextRequest, NextResponse } from 'next/server';
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
            expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
