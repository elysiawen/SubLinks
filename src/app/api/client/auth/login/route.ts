import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { createAccessToken, createRefreshToken } from '@/lib/jwt-client';

export const runtime = 'nodejs';

/**
 * Client Login API
 * POST /api/client/auth/login
 * Body: { username: string, password: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

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

        // Create tokens
        const tokenPayload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
        };

        const accessToken = await createAccessToken(tokenPayload);
        const refreshToken = await createRefreshToken(tokenPayload);

        // Log successful login
        await db.createSystemLog({
            category: 'system',
            message: `Client login: ${username}`,
            status: 'success',
            details: { username, role: user.role },
            timestamp: Date.now(),
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
            accessToken,
            refreshToken,
            expiresIn: 24 * 60 * 60, // 24 hours in seconds
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: '服务器内部错误' },
            { status: 500 }
        );
    }
}
