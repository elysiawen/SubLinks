import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyOAuthState, exchangeCodeForToken, fetchOAuthUserInfo, storeOAuthTempData } from '@/lib/oauth';
import { createSession } from '@/lib/auth';
import { nanoid } from 'nanoid';

const COOKIE_NAME = 'auth_session';

/**
 * Create a response that sets a cookie and redirects via HTML meta-refresh.
 * This is necessary because 307 redirects after cross-site OAuth flows
 * may cause browsers to drop Set-Cookie headers (SameSite redirect chain issue).
 * An HTML response ensures the browser fully processes the Set-Cookie before navigating.
 */
function cookieRedirect(targetUrl: string, sessionId: string): NextResponse {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieParts = [
        `${COOKIE_NAME}=${sessionId}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${7 * 24 * 60 * 60}`,
    ];
    if (isProd) cookieParts.push('Secure');
    const cookieStr = cookieParts.join('; ');

    const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${targetUrl}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;color:#333;-webkit-font-smoothing:antialiased}
.spinner{width:24px;height:24px;border:2.5px solid #e0e0e0;border-top-color:#667eea;border-radius:50%;margin:0 auto 16px;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:1rem;font-weight:600;margin-bottom:4px}
p{font-size:.8rem;color:#999}
</style>
</head>
<body>
<div style="text-align:center">
<div class="spinner"></div>
<h1>✅ 登录成功</h1>
<p>正在跳转...</p>
</div>
</body>
</html>`;

    return new NextResponse(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Set-Cookie': cookieStr,
        },
    });
}

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');

    console.log('[OAuth Callback] Received callback', { hasCode: !!code, hasState: !!state });

    if (!code || !state) {
        console.error('[OAuth Callback] Missing code or state');
        return NextResponse.redirect(new URL('/auth/login?error=invalidCallback', request.url));
    }

    // Verify state
    const stateData = await verifyOAuthState(state);
    if (!stateData) {
        console.error('[OAuth Callback] Invalid or expired state');
        return NextResponse.redirect(new URL('/auth/login?error=invalidState', request.url));
    }

    const providerId = stateData.providerId;
    const bindMode = stateData.bindMode;

    console.log('[OAuth Callback] State verified', { providerId, bindMode, deviceCode: !!stateData.deviceCode });

    const provider = await db.getOAuthProvider(providerId);
    if (!provider) {
        console.error('[OAuth Callback] Provider not found:', providerId);
        return NextResponse.redirect(new URL('/auth/login?error=providerNotFound', request.url));
    }

    try {
        // Exchange code for token
        console.log('[OAuth Callback] Exchanging code for token...');
        const tokenData = await exchangeCodeForToken(provider, code);
        console.log('[OAuth Callback] Token exchange success', { hasAccessToken: !!tokenData.access_token, hasRefreshToken: !!tokenData.refresh_token });

        // Fetch user info
        console.log('[OAuth Callback] Fetching user info...');
        const userInfo = await fetchOAuthUserInfo(provider, tokenData.access_token);
        console.log('[OAuth Callback] User info fetched', { providerUserId: userInfo.providerUserId, username: userInfo.username });

        // Check if binding exists
        const existingBinding = await db.getOAuthBinding(providerId, userInfo.providerUserId);
        console.log('[OAuth Callback] Existing binding:', existingBinding ? `found (id=${existingBinding.id})` : 'not found');

        // Determine if we have a valid binding with an active user
        let validUser: Awaited<ReturnType<typeof db.getUserById>> | null = null;

        if (existingBinding) {
            const user = await db.getUserById(existingBinding.userId);
            if (user && user.status === 'active') {
                validUser = user;
            } else if (!user) {
                // User deleted — clean up orphaned binding, allow re-registration
                console.log(`[OAuth Callback] User deleted for binding ${existingBinding.id}, cleaning up orphaned binding`);
                try {
                    await db.deleteOAuthBinding(existingBinding.id);
                } catch (e) {
                    console.error('[OAuth Callback] Failed to delete orphaned binding:', e);
                }
            } else {
                // User exists but is disabled/suspended — keep binding, block login
                console.log(`[OAuth Callback] User ${user.username} is ${user.status}, blocking OAuth login`);
                return NextResponse.redirect(new URL('/auth/login?error=accountDisabled', request.url));
            }
        }

        if (validUser) {
            // Existing binding with active user — login
            console.log('[OAuth Callback] Updating binding tokens...');
            try {
                await db.setOAuthBinding(existingBinding!.id, {
                    ...existingBinding!,
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || existingBinding!.refreshToken,
                    tokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : existingBinding!.tokenExpiresAt,
                    providerUsername: userInfo.username || existingBinding!.providerUsername,
                    providerAvatar: userInfo.avatar || existingBinding!.providerAvatar
                });
                console.log('[OAuth Callback] Binding updated successfully');
            } catch (bindError) {
                console.error('[OAuth Callback] Failed to update binding:', bindError);
            }

            const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
            const ua = request.headers.get('user-agent') || 'unknown';

            // Device flow
            if (stateData.deviceCode) {
                const sessionId = await createSession(validUser.username, validUser.role, ip, ua, 'device');
                console.log('[OAuth Callback] Device flow session created');
                return cookieRedirect(`/auth/device-confirm?code=${stateData.deviceCode}`, sessionId);
            }

            // Normal login
            const sessionId = await createSession(validUser.username, validUser.role, ip, ua, 'oauth');
            console.log('[OAuth Callback] Session created, redirecting to dashboard');
            return cookieRedirect('/dashboard?login=1', sessionId);
        }

        // No valid binding — treat as new user
        if (bindMode) {
            // Binding mode: user must be logged in
            // Try cookie first, then fall back to session ID stored in OAuth state
            let sessionId = request.cookies.get(COOKIE_NAME)?.value;
            if (!sessionId && stateData.sessionId) {
                console.log('[OAuth Bind] Cookie missing, using session ID from OAuth state');
                sessionId = stateData.sessionId;
            }
            if (!sessionId) {
                console.error('[OAuth Bind] No session cookie found and no session in state. Cookies:', request.cookies.getAll().map(c => c.name));
                return NextResponse.redirect(new URL('/auth/login?error=notLoggedIn', request.url));
            }
            const session = await import('@/lib/auth').then(m => m.getSession(sessionId));
            if (!session) {
                console.error('[OAuth Bind] Session invalid for cookie:', sessionId?.substring(0, 8) + '...');
                return NextResponse.redirect(new URL('/auth/login?error=sessionExpired', request.url));
            }

            // Create binding
            const bindingId = nanoid();
            console.log('[OAuth Bind] Creating binding...', { bindingId, userId: session.userId, providerId });
            try {
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
                console.log('[OAuth Bind] Binding created successfully');
            } catch (bindError) {
                console.error('[OAuth Bind] Failed to create binding:', bindError);
                return NextResponse.redirect(new URL('/auth/login?error=oauthFailed', request.url));
            }

            console.log('[OAuth Bind] Redirecting to settings');
            return NextResponse.redirect(new URL('/dashboard/settings?bound=1', request.url));
        }

        // Login mode - no binding exists — check provider-level auto-create setting
        if (provider.allowAutoCreate) {
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
        console.error('[OAuth Callback] Unhandled error:', error);
        return NextResponse.redirect(new URL('/auth/login?error=oauthFailed', request.url));
    }
}
