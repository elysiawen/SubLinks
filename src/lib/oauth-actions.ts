'use server'

import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { generateOAuthState, getBuiltinProviderTemplate } from '@/lib/oauth';
import { nanoid } from 'nanoid';
import type { OAuthProvider } from '@/lib/database/interface';

const COOKIE_NAME = 'auth_session';

async function getCurrentSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionId) return null;
    return getSession(sessionId);
}

// Get enabled OAuth providers (for login page and settings)
export async function getEnabledOAuthProviders(): Promise<OAuthProvider[]> {
    const providers = await db.getOAuthProviders();
    return providers.filter(p => p.enabled);
}

// Get all OAuth providers (for admin)
export async function getAllOAuthProviders(): Promise<OAuthProvider[]> {
    return db.getOAuthProviders();
}

// Get OAuth authorize URL (client-side use)
export async function getOAuthAuthorizeUrl(providerId: string, bindMode = false, deviceCode?: string): Promise<{ url?: string; error?: string }> {
    const provider = await db.getOAuthProvider(providerId);
    if (!provider || !provider.enabled) return { error: 'providerNotFound' };

    const state = await generateOAuthState(providerId, bindMode, deviceCode);
    const { getOAuthAuthorizeUrl: buildUrl } = await import('@/lib/oauth');
    const url = await buildUrl(provider, state, bindMode);
    return { url };
}

// Get current user's OAuth bindings
export async function getUserOAuthBindings() {
    const session = await getCurrentSession();
    if (!session) return { error: 'notLoggedIn' };

    const user = await db.getUserById(session.userId);
    if (!user) return { error: 'userNotFound' };

    const bindings = await db.getUserOAuthBindings(user.id);
    const providers = await db.getOAuthProviders();

    const enriched = bindings.map(binding => {
        const provider = providers.find(p => p.id === binding.providerId);
        return {
            ...binding,
            providerName: provider?.name || 'Unknown',
            providerType: provider?.type || 'custom',
            providerIcon: provider?.icon
        };
    });

    return { bindings: enriched };
}

// Unbind OAuth account
export async function unbindOAuth(bindingId: string) {
    const session = await getCurrentSession();
    if (!session) return { error: 'notLoggedIn' };

    const binding = await db.getOAuthBindingById(bindingId);
    if (!binding || binding.userId !== session.userId) return { error: 'bindingNotFound' };

    await db.deleteOAuthBinding(bindingId);
    return { success: true };
}

// Get available providers for binding (not yet bound)
export async function getAvailableOAuthProviders() {
    const session = await getCurrentSession();
    if (!session) return { error: 'notLoggedIn' };

    const user = await db.getUserById(session.userId);
    if (!user) return { error: 'userNotFound' };

    const allProviders = await db.getOAuthProviders();
    const enabledProviders = allProviders.filter(p => p.enabled);
    const bindings = await db.getUserOAuthBindings(user.id);
    const boundProviderIds = new Set(bindings.map(b => b.providerId));

    return {
        providers: enabledProviders.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            icon: p.icon,
            bound: boundProviderIds.has(p.id)
        }))
    };
}
