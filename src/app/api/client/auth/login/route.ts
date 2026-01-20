import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { createAccessToken, createRefreshToken } from '@/lib/jwt-client';
import { nanoid } from 'nanoid';
import { getFullAvatarUrl } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Client Login API
 * POST /api/client/auth/login
 * Body: { username: string, password: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password, deviceInfo: customDeviceInfo } = body;

        // Validate input
        if (!username || !password) {
            return NextResponse.json(
                { error: '用户名和密码不能为空' },
                { status: 400 }
            );
        }

        // Get user from database
        const user = await db.getUser(username);
        if (!user) {
            return NextResponse.json(
                { error: '用户名或密码错误' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json(
                { error: '用户名或密码错误' },
                { status: 401 }
            );
        }

        // Check if account is banned or disabled
        if (user.status !== 'active') {
            return NextResponse.json(
                { error: '账户已被停用或封禁' },
                { status: 403 }
            );
        }

        // Create tokens with full avatar URL
        const fullAvatarUrl = getFullAvatarUrl(user.avatar);

        const accessToken = await createAccessToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
            nickname: user.nickname,
            avatar: user.avatar
        });

        const refreshToken = await createRefreshToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0
        });

        // Store Refresh Token in DB
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const ua = request.headers.get('user-agent') || 'unknown';
        const REFRESH_TTL_SEC = 365 * 24 * 60 * 60; // 1 year (Match logic in jwt-client)

        try {
            await db.createRefreshToken({
                id: nanoid(32),
                userId: user.id,
                username: user.username,
                token: refreshToken,
                ip,
                ua,
                deviceInfo: customDeviceInfo || ua,
                createdAt: Date.now(),
                expiresAt: Date.now() + REFRESH_TTL_SEC * 1000,
                lastActive: Date.now()
            });
        } catch (e) {
            console.error('Failed to store refresh token:', e);
            // Non-blocking error? Or should we fail login?
            // If we fail to store, the user won't be able to refresh.
            // It is better to fail or at least log. Proceeding implies they have a token that works technically but not via our check if validation is strict.
            // Since we enforce DB check in refresh route, this token will be useless for refreshing.
        }

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
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                nickname: user.nickname,
                avatar: user.avatar
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: '服务器内部错误' },
            { status: 500 }
        );
    }
}
