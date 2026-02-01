import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BLOCKED_UAS = ['MicroMessenger', 'QQ/'];

export function middleware(request: NextRequest) {
    const ua = request.headers.get('user-agent') || '';
    const path = request.nextUrl.pathname;

    // Handle CORS for client API routes
    if (path.startsWith('/api/client/')) {
        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        // Add CORS headers to actual requests
        const response = NextResponse.next();
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return response;
    }

    // Block WeChat and QQ (UA Blocking)
    // Applies to all routes in matcher
    if (BLOCKED_UAS.some(blocked => ua.includes(blocked))) {
        return new NextResponse(
            '<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><h1>请点击右上角，选择在浏览器中打开</h1></body></html>',
            { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }

    // Auth Check (Session Cookie Existence)
    // We do NOT verify session in middleware because it requires DB access which isn't available in Edge Middleware easily.
    // We let Layout/Page verify the validity. Middleware just redirects "obviously unauthenticated" users.

    const isProtectedRoute = path.startsWith('/admin') || path.startsWith('/dashboard');
    const hasSession = request.cookies.has('auth_session');

    if (isProtectedRoute && !hasSession) {
        const url = new URL('/login', request.url);
        url.searchParams.set('callbackUrl', path);
        return NextResponse.redirect(url);
    }

    // If we are on login page:
    if (path === '/login') {
        const isRevoked = request.nextUrl.searchParams.has('revoked');

        // 1. If signaled as revoked, clear cookie and stay on login
        if (isRevoked && hasSession) {
            const response = NextResponse.next();
            response.cookies.delete('auth_session');
            return response;
        }

        // 2. If not revoked and has a session, optimize by redirecting to dashboard
        if (!isRevoked && hasSession) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    const response = NextResponse.next();

    // Refresh session cookie if user is logged in (Rolling Expiration)
    if (hasSession) {
        const cookieValue = request.cookies.get('auth_session')?.value;
        if (cookieValue) {
            response.cookies.set('auth_session', cookieValue, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60, // 7 days
                path: '/',
            });
        }
    }

    return response;
}

export const config = {
    matcher: ['/api/s/:path*', '/api/client/:path*', '/admin/:path*', '/dashboard/:path*', '/login'],
}
