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
    // We do NOT verify session in middleware because it requires DB access (Redis) which isn't available in Edge Middleware easily without Upstash REST.
    // We let Layout/Page verify the validity. Middleware just redirects "obviously unauthenticated" users.

    const isProtectedRoute = path.startsWith('/admin') || path.startsWith('/dashboard');
    const hasSession = request.cookies.has('auth_session');

    if (isProtectedRoute && !hasSession) {
        const url = new URL('/login', request.url);
        url.searchParams.set('callbackUrl', path);
        return NextResponse.redirect(url);
    }

    // If logged in but trying to access login, redirect to dashboard/admin
    // (Optimization)
    if (path === '/login' && hasSession) {
        // Default to dashboard, page will redirect if admin
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/api/s/:path*', '/api/client/:path*', '/admin/:path*', '/dashboard/:path*', '/login'],
}
