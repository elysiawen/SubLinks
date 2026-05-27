import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateOAuthState, getOAuthAuthorizeUrl } from '@/lib/oauth';

export async function GET(request: NextRequest) {
    const providerId = request.nextUrl.searchParams.get('provider');
    const bindMode = request.nextUrl.searchParams.get('bind') === '1';

    if (!providerId) {
        return NextResponse.redirect(new URL('/auth/login?error=missingProvider', request.url));
    }

    const provider = await db.getOAuthProvider(providerId);
    if (!provider || !provider.enabled) {
        return NextResponse.redirect(new URL('/auth/login?error=providerNotFound', request.url));
    }

    const state = await generateOAuthState(providerId, bindMode);
    const authorizeUrl = await getOAuthAuthorizeUrl(provider, state, bindMode);

    return NextResponse.redirect(authorizeUrl);
}
