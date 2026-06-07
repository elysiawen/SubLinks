import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyOAuthState, exchangeCodeForToken, fetchOAuthUserInfo, storeOAuthTempData } from '@/lib/oauth';
import { createSession } from '@/lib/auth';
import { nanoid } from 'nanoid';

const COOKIE_NAME = 'auth_session';

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');

    if (!code || !state) {
        return NextResponse.redirect(new URL('/auth/login?error=invalidCallback', request.url));
    }

    // Verify state
    const stateData = await verifyOAuthState(state);
    if (!stateData) {
        return NextResponse.redirect(new URL('/auth/login?error=invalidState', request.url));
    }

    const providerId = stateData.providerId;
    const bindMode = stateData.bindMode;

    const provider = await db.getOAuthProvider(providerId);
    if (!provider) {
        return NextResponse.redirect(new URL('/auth/login?error=providerNotFound', request.url));
    }

    try {
        // Exchange code for token
        const tokenData = await exchangeCodeForToken(provider, code);

        // Fetch user info
        const userInfo = await fetchOAuthUserInfo(provider, tokenData.access_token);

        // Check if binding exists
        const existingBinding = await db.getOAuthBinding(providerId, userInfo.providerUserId);

        if (existingBinding) {
            // Already bound - login as that user
            const user = await db.getUserById(existingBinding.userId);
            if (!user) {
                return NextResponse.redirect(new URL('/auth/login?error=userNotFound', request.url));
            }
            if (user.status !== 'active') {
                return NextResponse.redirect(new URL('/auth/login?error=accountDisabled', request.url));
            }

            // Update token
            await db.setOAuthBinding(existingBinding.id, {
                ...existingBinding,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || existingBinding.refreshToken,
                tokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : existingBinding.tokenExpiresAt,
                providerUsername: userInfo.username || existingBinding.providerUsername,
                providerAvatar: userInfo.avatar || existingBinding.providerAvatar
            });

            const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
            const ua = request.headers.get('user-agent') || 'unknown';

            // Device flow: create session then redirect to confirm page
            if (stateData.deviceCode) {
                const sessionId = await createSession(user.username, user.role, ip, ua, 'device');
                const response = NextResponse.redirect(new URL(`/auth/device-confirm?code=${stateData.deviceCode}`, request.url));
                response.cookies.set(COOKIE_NAME, sessionId, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60
                });
                return response;
            }

            // Normal flow: create session
            const sessionId = await createSession(user.username, user.role, ip, ua, 'oauth');

            const response = NextResponse.redirect(new URL('/dashboard?login=1', request.url));
            response.cookies.set(COOKIE_NAME, sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60
            });
            return response;
        }

        // No existing binding
        if (bindMode) {
            // Binding mode: user must be logged in
            // Use request.cookies to read from the incoming request directly
            const sessionId = request.cookies.get(COOKIE_NAME)?.value;
            if (!sessionId) {
                console.error('[OAuth Bind] No session cookie found. Cookies:', request.cookies.getAll().map(c => c.name));
                return NextResponse.redirect(new URL('/auth/login?error=notLoggedIn', request.url));
            }
            const session = await import('@/lib/auth').then(m => m.getSession(sessionId));
            if (!session) {
                console.error('[OAuth Bind] Session invalid for cookie:', sessionId?.substring(0, 8) + '...');
                return NextResponse.redirect(new URL('/auth/login?error=sessionExpired', request.url));
            }

            // Create binding
            const bindingId = nanoid();
            await db.setOAuthBinding(bindingId, {
                id: bindingId,
                userId: session.userId,
                providerId,
                providerUserId: userInfo.providerUserId,
                providerUsername: userInfo.username,
                providerAvatar: userInfo.avatar,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                tokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
                createdAt: Date.now()
            });

            console.log('[OAuth Bind] Binding created:', bindingId, 'user:', session.userId, 'provider:', providerId);
            return NextResponse.redirect(new URL('/dashboard/settings?bound=1', request.url));
        }

        // Login mode - no binding exists
        const config = await db.getGlobalConfig();

        if (config.oauthAllowAutoCreate) {
            // Auto-create allowed - redirect to confirm page
            const tempToken = await storeOAuthTempData({
                providerId,
                providerUserId: userInfo.providerUserId,
                providerUsername: userInfo.username,
                providerAvatar: userInfo.avatar,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                tokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined
            });

            const confirmUrl = stateData.deviceCode
                ? `/auth/oauth-confirm?token=${tempToken}&device=${stateData.deviceCode}`
                : `/auth/oauth-confirm?token=${tempToken}`;
            return NextResponse.redirect(new URL(confirmUrl, request.url));
        }

        // Auto-create not allowed
        return NextResponse.redirect(new URL('/auth/login?error=accountNotLinked', request.url));

    } catch (error) {
        console.error('OAuth callback error:', error);
        return NextResponse.redirect(new URL('/auth/login?error=oauthFailed', request.url));
    }
}
