'use server'

import { db } from '@/lib/db';
import { getOAuthTempData as getTempData, storeOAuthTempData } from '@/lib/oauth';
import { createSession } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'auth_session';

export async function getOAuthTempData(token: string) {
    return getTempData(token);
}

export async function confirmOAuthCreateAccount(token: string, username: string) {
    if (!token || !username) return { error: 'missingFields' };

    // Validate username
    if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 2 || username.length > 32) {
        return { error: 'invalidUsername' };
    }

    const tempData = await getTempData(token);
    if (!tempData) return { error: 'expired' };

    // Check if username exists
    if (await db.userExists(username)) {
        return { error: 'usernameExists' };
    }

    // Generate a random password (user will login via OAuth)
    const randomPassword = nanoid(32);
    const hashedPassword = await hashPassword(randomPassword);

    // Create user
    const userId = '';
    await db.setUser(username, {
        id: userId,
        username,
        password: hashedPassword,
        role: 'user',
        status: 'active',
        maxSubscriptions: null,
        createdAt: Date.now(),
        tokenVersion: nanoid(16)
    });

    // Get created user (to get the generated UUID)
    const user = await db.getUser(username);
    if (!user) return { error: 'userCreationFailed' };

    // Create OAuth binding
    const bindingId = nanoid(21);
    await db.setOAuthBinding(bindingId, {
        id: bindingId,
        userId: user.id,
        providerId: tempData.providerId,
        providerUserId: tempData.providerUserId,
        providerUsername: tempData.providerUsername,
        providerAvatar: tempData.providerAvatar,
        accessToken: tempData.accessToken,
        refreshToken: tempData.refreshToken,
        tokenExpiresAt: tempData.tokenExpiresAt,
        createdAt: Date.now()
    });

    // Create session
    const sessionId = await createSession(username, 'user', undefined, undefined, 'oauth');

    // Set cookie
    (await cookies()).set(COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60
    });

    return { success: true };
}
