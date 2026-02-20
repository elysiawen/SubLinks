
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/jwt-client';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const accessToken = extractBearerToken(authHeader);

        if (!accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifyToken(accessToken);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }

        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'QR Token is required' }, { status: 400 });
        }

        // Security check: Verify the confirming device's session is still valid.
        // The access token contains refreshTokenId (the DB ID of the device's refresh token).
        // When a device is kicked offline, its refresh token is deleted from DB.
        // We check if this specific device's refresh token still exists.
        if (payload.refreshTokenId) {
            // Precise device-level check: verify this device's refresh token still exists in DB
            const userTokens = await db.getUserRefreshTokens(payload.userId);
            const deviceTokenExists = userTokens.some(t => t.id === payload.refreshTokenId);
            if (!deviceTokenExists) {
                return NextResponse.json(
                    { error: 'Device session has been revoked. Please re-login.' },
                    { status: 401 }
                );
            }
        } else {
            // Fallback for older tokens that don't contain refreshTokenId:
            // Check if user has ANY valid refresh token (original behavior)
            const userRefreshTokens = await db.getUserRefreshTokens(payload.userId);
            if (!userRefreshTokens || userRefreshTokens.length === 0) {
                return NextResponse.json({ error: 'Session has been revoked' }, { status: 401 });
            }
        }

        const cacheKey = `qr:${token}`;
        const cacheData = await db.getCache(cacheKey);

        if (!cacheData) {
            return NextResponse.json({ error: 'Invalid or expired QR token' }, { status: 404 });
        }

        const data = JSON.parse(cacheData);

        if (Date.now() > data.expiresAt) {
            return NextResponse.json({ error: 'QR Token expired' }, { status: 400 });
        }

        if (data.status !== 'scanned' && data.status !== 'pending') {
            if (data.status === 'confirmed') {
                return NextResponse.json({ success: true, message: 'Already confirmed' });
            }
            return NextResponse.json({ error: 'Invalid QR token status' }, { status: 400 });
        }

        // Update status to confirmed and attach userId
        const newData = {
            ...data,
            status: 'confirmed',
            userId: payload.userId,
            username: payload.username
        };

        await db.setCache(cacheKey, JSON.stringify(newData));

        return NextResponse.json({
            success: true,
            message: 'Login confirmed'
        });
    } catch (error) {
        console.error('QR Confirm Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
