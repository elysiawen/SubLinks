import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tApi } from '@/lib/api-i18n';

export const runtime = 'nodejs';

const CONSUMED_TTL = 10; // seconds — window for duplicate requests after auth

/**
 * Device Code Token Polling
 * POST /api/client/auth/device/token
 * Body: { deviceCode: string }
 *
 * The client polls this endpoint until the user completes browser-based authentication.
 * - authorization_pending: user hasn't authenticated yet (HTTP 400)
 * - expired: device code has expired (HTTP 400)
 * - success: tokens ready (HTTP 200, one-time delivery with short consumed window)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { deviceCode } = body;

        if (!deviceCode) {
            return NextResponse.json(
                { error: await tApi('auth.deviceCodeRequired') },
                { status: 400 }
            );
        }

        // Lazy cleanup on every poll
        await db.cleanupDeviceCache?.().catch((e: unknown) =>
            console.error('Device cache cleanup failed:', e)
        );

        const cacheData = await db.getCache(`device:${deviceCode}`);

        if (!cacheData) {
            return NextResponse.json(
                { error: await tApi('auth.deviceCodeInvalid') },
                { status: 404 }
            );
        }

        let data;
        try {
            data = JSON.parse(cacheData);
        } catch {
            return NextResponse.json(
                { error: await tApi('auth.deviceCodeInvalid') },
                { status: 404 }
            );
        }

        // Consumed: tokens were already delivered, but still in the grace window
        if (data.status === 'consumed') {
            return NextResponse.json({
                success: true,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                user: data.user,
            });
        }

        // Expired
        if (data.status === 'pending' && Date.now() > data.expiresAt) {
            await db.deleteCache(`device:${deviceCode}`);
            return NextResponse.json(
                { error: await tApi('auth.deviceCodeExpired') },
                { status: 400 }
            );
        }

        // Still pending — user hasn't authenticated yet
        if (data.status === 'pending') {
            return NextResponse.json(
                { error: 'authorization_pending' },
                { status: 400 }
            );
        }

        // User denied the authorization
        if (data.status === 'denied') {
            await db.deleteCache(`device:${deviceCode}`);
            return NextResponse.json(
                { error: 'authorization_denied' },
                { status: 400 }
            );
        }

        // Authenticated — deliver tokens, mark as consumed
        if (data.status === 'authenticated') {
            // Transition to consumed state with a short TTL for duplicate-request safety
            await db.setCache(
                `device:${deviceCode}`,
                JSON.stringify({
                    status: 'consumed',
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    user: data.user,
                }),
                CONSUMED_TTL
            );

            return NextResponse.json({
                success: true,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                user: data.user,
            });
        }

        // Unknown status
        return NextResponse.json(
            { error: await tApi('auth.deviceCodeInvalid') },
            { status: 400 }
        );
    } catch (error) {
        console.error('Device token error:', error);
        return NextResponse.json(
            { error: await tApi('auth.internalError') },
            { status: 500 }
        );
    }
}
