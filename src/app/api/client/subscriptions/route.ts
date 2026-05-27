import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/jwt-client';
import { tApi } from '@/lib/api-i18n';
import { getBaseUrl } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Get User Subscriptions API
 * GET /api/client/subscriptions
 * Headers: Authorization: Bearer <token>
 */
export async function GET(request: NextRequest) {
    try {
        // Extract and verify token
        const authHeader = request.headers.get('authorization');
        const token = extractBearerToken(authHeader);

        if (!token) {
            return NextResponse.json(
                { error: await tApi('auth.noToken') },
                { status: 401 }
            );
        }

        const payload = await verifyToken(token);
        if (!payload) {
            return NextResponse.json(
                { error: await tApi('auth.invalidToken') },
                { status: 401 }
            );
        }

        // Get user subscriptions
        const subscriptions = await db.getUserSubscriptions(payload.userId);

        // Format subscriptions for client
        const formattedSubscriptions = subscriptions.map(sub => ({
            token: sub.token,
            name: sub.remark || 'Unnamed Subscription', // Use remark as name
            url: `${getBaseUrl()}/api/s/${sub.token}`,
            enabled: sub.enabled,
            createdAt: sub.createdAt,
        }));

        return NextResponse.json({
            success: true,
            subscriptions: formattedSubscriptions,
        });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        return NextResponse.json(
            { error: await tApi('auth.internalError') },
            { status: 500 }
        );
    }
}
