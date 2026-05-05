import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt-client';
import { tApi } from '@/lib/api-i18n';

export const runtime = 'nodejs';

/**
 * Client Logout API
 * POST /api/client/auth/logout
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

        // Optional: Verify token first to get userId or just delete directly
        // Deleting directly is faster and safer for logout
        await db.deleteRefreshToken(refreshToken);

        return NextResponse.json({
            success: true,
            message: await tApi('auth.logoutSuccess')
        });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: await tApi('auth.internalError') },
            { status: 500 }
        );
    }
}
