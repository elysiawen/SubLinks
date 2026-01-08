import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/jwt-client';

export const runtime = 'nodejs';

/**
 * Get User Profile API
 * GET /api/client/profile
 * Headers: Authorization: Bearer <token>
 */
export async function GET(request: NextRequest) {
    try {
        // Extract and verify token
        const authHeader = request.headers.get('authorization');
        const token = extractBearerToken(authHeader);

        if (!token) {
            return NextResponse.json(
                { error: 'Authorization token required' },
                { status: 401 }
            );
        }

        const payload = await verifyToken(token);
        if (!payload) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        // Get user details
        const user = await db.getUser(payload.username);
        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get subscription count
        const subscriptions = await db.getUserSubscriptions(payload.username);

        return NextResponse.json({
            success: true,
            profile: {
                id: user.id,
                username: user.username,
                role: user.role,
                subscriptionCount: subscriptions.length,
            },
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
