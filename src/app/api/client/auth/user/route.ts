import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/jwt-client';
import { getFullAvatarUrl } from '@/lib/utils';
import { tApi } from '@/lib/api-i18n';
import { db } from '@/lib/db';

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

        // Fetch current user data from DB (payload may be stale after rename)
        const user = await db.getUserById(payload.userId);
        if (!user || user.status !== 'active') {
            return NextResponse.json(
                { error: await tApi('auth.invalidToken') },
                { status: 401 }
            );
        }

        // Return user info
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                nickname: user.nickname,
                avatar: getFullAvatarUrl(user.avatar)
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
