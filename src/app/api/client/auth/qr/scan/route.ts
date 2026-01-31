
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        const cacheKey = `qr:${token}`;
        const cacheData = await db.getCache(cacheKey);

        if (!cacheData) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
        }

        const data = JSON.parse(cacheData);

        if (Date.now() > data.expiresAt) {
            return NextResponse.json({ error: 'Token expired' }, { status: 400 });
        }

        if (data.status !== 'pending' && data.status !== 'scanned') {
            return NextResponse.json({ error: 'Invalid token status' }, { status: 400 });
        }

        // Update status to scanned
        const newData = { ...data, status: 'scanned' };
        // Determine TTL (remaining time)? Or just let it expire naturally?
        // Postgres `setCache` re-sets `expiresAt`. We should preserve the original expiration or slightly extend?
        // Let's keep original expiresAt.
        // `setCache` (Postgres implementation) resets `expires_at` to `Date.now()`.
        // Wait, step 317: `expiresAt = Date.now()` in `setCache`. This means "Last Updated".
        // My `actions.ts` logic relies on `data.expiresAt` payload field, NOT the DB column.
        // So I just need to update the JSON payload.

        await db.setCache(cacheKey, JSON.stringify(newData));

        return NextResponse.json({
            success: true,
            data: {
                ip: data.ip,
                ua: data.ua,
                // location: data.location // If available
            }
        });
    } catch (error) {
        console.error('QR Scan Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
