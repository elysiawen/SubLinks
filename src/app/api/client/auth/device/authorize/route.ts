import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';
import { tApi } from '@/lib/api-i18n';

export const runtime = 'nodejs';

const DEVICE_CODE_TTL = 300; // 5 minutes in seconds
const DEVICE_CODE_INTERVAL = 5; // minimum polling interval in seconds
const MAX_DEVICE_CODES_PER_IP = 5; // max concurrent pending device codes per IP

/**
 * Device Code Authorization
 * POST /api/client/auth/device/authorize
 *
 * Generates a device code for browser-based login flow (RFC 8628-like).
 * The client opens the verification URI in a browser, the user authenticates
 * (via Passkey, password, or OAuth), and the client polls for the tokens.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { deviceInfo: clientDeviceInfo } = body;

        // Capture client app's IP and UA from the request headers
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
        const clientUa = request.headers.get('user-agent') || 'unknown';
        const normalizedIp = clientIp.replace(/^::ffff:/, '');

        // Lazy cleanup: delete expired device codes from cache
        await db.cleanupDeviceCache?.().catch((e: unknown) =>
            console.error('Device cache cleanup failed:', e)
        );

        // Check concurrent device codes per IP
        if (normalizedIp !== 'unknown') {
            const ipIndexKey = `device:ip:${normalizedIp}`;
            const ipIndexRaw = await db.getCache(ipIndexKey);
            let activeCodes: Array<{ code: string; expiresAt: number }> = [];

            if (ipIndexRaw) {
                try {
                    activeCodes = JSON.parse(ipIndexRaw);
                    // Filter out expired and consumed codes
                    const now = Date.now();
                    activeCodes = activeCodes.filter(c => c.expiresAt > now);
                } catch {
                    activeCodes = [];
                }
            }

            if (activeCodes.length >= MAX_DEVICE_CODES_PER_IP) {
                return NextResponse.json(
                    { error: await tApi('auth.deviceCodeLimitReached') },
                    { status: 429 }
                );
            }

            // Create new device code
            const deviceCode = crypto.randomUUID();
            const expiresAt = Date.now() + DEVICE_CODE_TTL * 1000;

            // Add to IP index
            activeCodes.push({ code: deviceCode, expiresAt });
            await db.setCache(ipIndexKey, JSON.stringify(activeCodes), DEVICE_CODE_TTL);

            // Store device code data
            const payload = JSON.stringify({
                status: 'pending',
                expiresAt,
                createdAt: Date.now(),
                clientIp,
                clientUa,
                clientDeviceInfo: clientDeviceInfo || clientUa,
            });
            await db.setCache(`device:${deviceCode}`, payload, DEVICE_CODE_TTL);

            const verificationUri = `${getBaseUrl()}/auth/login?deviceCode=${deviceCode}`;

            return NextResponse.json({
                deviceCode,
                verificationUri,
                expiresIn: DEVICE_CODE_TTL,
                interval: DEVICE_CODE_INTERVAL,
            });
        }

        // Unknown IP — skip rate limiting
        const deviceCode = crypto.randomUUID();
        const expiresAt = Date.now() + DEVICE_CODE_TTL * 1000;

        const payload = JSON.stringify({
            status: 'pending',
            expiresAt,
            createdAt: Date.now(),
            clientIp,
            clientUa,
            clientDeviceInfo: clientDeviceInfo || clientUa,
        });
        await db.setCache(`device:${deviceCode}`, payload, DEVICE_CODE_TTL);

        const verificationUri = `${getBaseUrl()}/auth/login?deviceCode=${deviceCode}`;

        return NextResponse.json({
            deviceCode,
            verificationUri,
            expiresIn: DEVICE_CODE_TTL,
            interval: DEVICE_CODE_INTERVAL,
        });
    } catch (error) {
        console.error('Device authorize error:', error);
        return NextResponse.json(
            { error: await tApi('auth.internalError') },
            { status: 500 }
        );
    }
}
