import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/jwt-client';
import { getFullAvatarUrl } from '@/lib/utils';
import { tApi } from '@/lib/api-i18n';

export const runtime = 'nodejs';

/**
 * Get Current User Info
 * GET /api/client/auth/user
 * Headers: Authorization: Bearer <token>
 */
export async function GET(request: NextRequest) {
    try {
        // Extract token
        const authHeader = request.headers.get('authorization');
        const token = extractBearerToken(authHeader);

        if (!token) {
            return NextResponse.json(
                { error: await tApi('auth.noToken') },
                { status: 401 }
            );
        }

        // Verify token
        const payload = await verifyToken(token);

        if (!payload) {
            return NextResponse.json(
                { error: await tApi('auth.invalidToken') },
                { status: 401 }
            );
        }

        // Return user info
        return NextResponse.json({
            success: true,
            user: {
                id: payload.userId,
                username: payload.username,
                role: payload.role,
                nickname: payload.nickname,
                avatar: getFullAvatarUrl(payload.avatar) // Ensure full URL
            }
        });

    } catch (error) {
        console.error('Get user info error:', error);
        return NextResponse.json(
            { error: await tApi('auth.internalError') },
            { status: 500 }
        );
    }
}
