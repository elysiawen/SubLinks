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
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Get user from database
        const user = await db.getUser(username);
        if (!user) {
            return NextResponse.json(
                { error: 'Invalid username or password' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid username or password' },
                { status: 401 }
            );
        }

        // Create tokens
        const tokenPayload = {
            userId: user.id,
            username: user.username,
            role: user.role,
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
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
