import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { createClientTokensForUser } from '@/lib/device-auth-helpers';
import { tApi } from '@/lib/api-i18n';

export const runtime = 'nodejs';

/**
 * Client Login API
 * POST /api/client/auth/login
 * Body: { username: string, password: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password, code, deviceInfo: customDeviceInfo } = body;

        // Validate input
        if (!username || !password) {
            return NextResponse.json(
                { error: await tApi('auth.emptyCredentials') },
                { status: 400 }
            );
        }

        // Get user from database
        const user = await db.getUser(username);
        if (!user) {
            return NextResponse.json(
                { error: await tApi('auth.userNotFound') },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json(
                { error: await tApi('auth.userNotFound') },
                { status: 401 }
            );
        }

        // Check if account is banned or disabled
        if (user.status !== 'active') {
            return NextResponse.json(
                { error: await tApi('auth.accountDisabled') },
                { status: 403 }
            );
        }

        // 2FA TOTP Verification
        if (user.totpEnabled) {
            if (!code) {
                // Phase 1: Signal client that 2FA code is required
                return NextResponse.json({
                    requires2FA: true,
                    message: await tApi('auth.twoFactorRequired')
                });
            }

            // Phase 2: Verify the TOTP code
            const { verify } = await import('otplib');
            let isValid2FA = false;
            try {
                const result = await verify({ token: code, secret: user.totpSecret || '' });
                isValid2FA = !!(result && result.valid);
            } catch {
                isValid2FA = false;
            }

            if (!isValid2FA) {
                return NextResponse.json(
                    { error: await tApi('auth.twoFactorInvalid') },
                    { status: 401 }
                );
            }
        }

        // Create tokens and store refresh token in DB
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const ua = request.headers.get('user-agent') || 'unknown';

        const tokens = await createClientTokensForUser(user, ip, ua, customDeviceInfo, 'password');

        // Log successful login
        await db.createSystemLog({
            category: 'system',
            message: `Client login: ${username}`,
            status: 'success',
            details: { username, role: user.role, ip, ua },
            timestamp: Date.now(),
        });

        return NextResponse.json({
            success: true,
            ...tokens
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: await tApi('auth.internalError') },
            { status: 500 }
        );
    }
}
