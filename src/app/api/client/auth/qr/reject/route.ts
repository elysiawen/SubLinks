
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractBearerToken } from '@/lib/jwt-client';

export async function POST(request: NextRequest) {
    try {
        // Authenticate (Reject should also require auth to prevent spamming rejections on random tokens?)
        // Yes, usually reject comes from an authenticated user on the mobile app.
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

        const cacheKey = `qr:${token}`;
        const cacheData = await db.getCache(cacheKey);

        if (!cacheData) {
            return NextResponse.json({ error: 'Invalid or expired QR token' }, { status: 404 });
        }

        const data = JSON.parse(cacheData);

        if (Date.now() > data.expiresAt) {
            return NextResponse.json({ error: 'QR Token expired' }, { status: 400 });
        }

        if (data.status === 'confirmed') {
            return NextResponse.json({ error: 'Already confirmed' }, { status: 400 });
        }

        // Update status to rejected
        const newData = {
            ...data,
            status: 'rejected',
            userId: payload.userId // Optional: record who rejected it
        };

        await db.setCache(cacheKey, JSON.stringify(newData));

        return NextResponse.json({
            success: true,
            message: 'Login rejected'
        });
    } catch (error) {
        console.error('QR Reject Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
