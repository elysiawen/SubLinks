import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt-client';

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
                { error: 'Refresh token is required' },
                { status: 400 }
            );
        }

        // Optional: Verify token first to get userId or just delete directly
        // Deleting directly is faster and safer for logout
        await db.deleteRefreshToken(refreshToken);

        return NextResponse.json({
            success: true,
            message: 'Successfully logged out'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
