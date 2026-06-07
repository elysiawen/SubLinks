import { db } from './db';
import { getBaseUrl } from './utils';
import type { OAuthProvider } from './database/interface';

const OAUTH_STATE_TTL = 5 * 60; // 5 minutes

// Built-in provider endpoints
const BUILTIN_PROVIDERS: Record<string, Partial<OAuthProvider>> = {
    google: {
        name: 'Google',
        type: 'google',
        icon: 'google',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scope: 'openid email profile'
    },
    github: {
        name: 'GitHub',
        type: 'github',
        icon: 'github',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scope: 'read:user user:email'
    }
};

export function getBuiltinProviderTemplate(type: string) {
    return BUILTIN_PROVIDERS[type] || null;
}

export async function getOAuthAuthorizeUrl(provider: OAuthProvider, state: string, bindMode = false): Promise<string> {
    const authUrl = provider.type !== 'custom'
        ? BUILTIN_PROVIDERS[provider.type]?.authorizationUrl || provider.authorizationUrl
        : provider.authorizationUrl;

    if (!authUrl) throw new Error('authorizationUrl not configured');

    const params: Record<string, string> = {
        client_id: provider.clientId,
        redirect_uri: `${getBaseUrl()}/api/oauth/callback`,
        response_type: 'code',
        scope: provider.scope || '',
        state,
        access_type: 'offline',
    };
    if (provider.forceConsent !== false) {
        params.prompt = 'consent';
    }

    const searchParams = new URLSearchParams(params);

    return `${authUrl}?${searchParams.toString()}`;
}

export async function exchangeCodeForToken(provider: OAuthProvider, code: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
    const tokenUrl = provider.type !== 'custom'
        ? BUILTIN_PROVIDERS[provider.type]?.tokenUrl || provider.tokenUrl
        : provider.tokenUrl;

    if (!tokenUrl) throw new Error('tokenUrl not configured');

    const isGithub = provider.type === 'github';
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const body = new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: `${getBaseUrl()}/api/oauth/callback`,
        grant_type: 'authorization_code'
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers,
        body: body.toString()
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in
    };
}

export interface OAuthUserInfo {
    providerUserId: string;
    username: string;
    avatar?: string;
    email?: string;
}

export async function fetchOAuthUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo> {
    const userInfoUrl = provider.type !== 'custom'
        ? BUILTIN_PROVIDERS[provider.type]?.userInfoUrl || provider.userInfoUrl
        : provider.userInfoUrl;

    if (!userInfoUrl) throw new Error('userInfoUrl not configured');

    const response = await fetch(userInfoUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    const data = await response.json();

    if (provider.type === 'google') {
        return {
            providerUserId: String(data.id),
            username: data.name || data.email,
            avatar: data.picture,
            email: data.email
        };
    }

    if (provider.type === 'github') {
        return {
            providerUserId: String(data.id),
            username: data.login || data.name,
            avatar: data.avatar_url,
            email: data.email
        };
    }

    // Custom: try common field names
    return {
        providerUserId: String(data.id || data.sub || data.user_id),
        username: data.username || data.login || data.name || data.preferred_username || '',
        avatar: data.avatar_url || data.picture || data.avatar,
        email: data.email
    };
}

// Generate OAuth state and store in cache
export async function generateOAuthState(providerId: string, bindMode: boolean, deviceCode?: string): Promise<string> {
    const { nanoid } = await import('nanoid');
    const state = nanoid(32);
    await db.setCache(`oauth:state:${state}`, JSON.stringify({ providerId, bindMode, deviceCode: deviceCode || null, ts: Date.now() }), OAUTH_STATE_TTL);
    return state;
}

// Verify and consume OAuth state
export async function verifyOAuthState(state: string): Promise<{ providerId: string; bindMode: boolean; deviceCode?: string } | null> {
    const data = await db.getCache(`oauth:state:${state}`);
    if (!data) return null;
    await db.deleteCache(`oauth:state:${state}`);
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

// Store temporary OAuth data for confirm page (auto-create flow)
export async function storeOAuthTempData(data: {
    providerId: string;
    providerUserId: string;
    providerUsername?: string;
    providerAvatar?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
}): Promise<string> {
    const { nanoid } = await import('nanoid');
    const token = nanoid(32);
    await db.setCache(`oauth:temp:${token}`, JSON.stringify(data), 10 * 60); // 10 min TTL
    return token;
}

// Retrieve temporary OAuth data for confirm page
export async function getOAuthTempData(token: string): Promise<{
    providerId: string;
    providerUserId: string;
    providerUsername?: string;
    providerAvatar?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
} | null> {
    const data = await db.getCache(`oauth:temp:${token}`);
    if (!data) return null;
    await db.deleteCache(`oauth:temp:${token}`);
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}
