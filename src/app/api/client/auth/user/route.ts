import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/jwt-client';
import { getFullAvatarUrl } from '@/lib/utils';

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
                { error: '未提供认证令牌' },
                { status: 401 }
            );
        }

        // Verify token
        const payload = await verifyToken(token);

        if (!payload) {
            return NextResponse.json(
                { error: '无效或过期的令牌' },
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
            { error: '服务器内部错误' },
            { status: 500 }
        );
    }
}
