
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

        // Security check: Ensure the user's session hasn't been revoked
        // If the user was forcibly logged out, their refresh tokens would be deleted
        const userRefreshTokens = await db.getUserRefreshTokens(payload.userId);
        if (!userRefreshTokens || userRefreshTokens.length === 0) {
            return NextResponse.json({ error: 'Session has been revoked' }, { status: 401 });
        }

        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'QR Token is required' }, { status: 400 });
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
            // Allowing 'pending' just in case user didn't scan first (direct confirm?), 
            // but usually flow is Scan -> Confirm.
            // If status is already 'confirmed', we can return success or error.
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
            username: payload.username // Optional, helpful for debugging
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
