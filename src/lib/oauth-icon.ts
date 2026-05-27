export interface IconConfig {
    mode: 'default' | 'auto' | 'custom';
    url?: string;
}

export type IconResolution =
    | { type: 'svg'; name: 'google' | 'github' | 'link' }
    | { type: 'image'; url: string };

const BUILTIN_DOMAINS: Record<string, string> = {
    google: 'accounts.google.com',
    github: 'github.com',
};

export function parseIconConfig(icon?: string | null): IconConfig {
    if (!icon) return { mode: 'default' };
    try {
        const parsed = JSON.parse(icon);
        if (parsed && typeof parsed === 'object' && (parsed.mode === 'default' || parsed.mode === 'auto' || parsed.mode === 'custom')) {
            return parsed;
        }
    } catch {
        // legacy string like "google", "github" — treat as default
    }
    return { mode: 'default' };
}

export function extractDomain(url: string): string | null {
    try {
        const u = new URL(url);
        return u.hostname;
    } catch {
        return null;
    }
}

export function buildFaviconApiUrl(domain: string): string {
    return `/api/oauth/favicon?domain=${encodeURIComponent(domain)}`;
}

export function resolveProviderIcon(provider: {
    type: string;
    icon?: string | null;
    authorizationUrl?: string;
}): IconResolution {
    const config = parseIconConfig(provider.icon);

    if (config.mode === 'auto') {
        const domain = extractDomain(provider.authorizationUrl || '')
            || BUILTIN_DOMAINS[provider.type];
        if (domain) {
            return { type: 'image', url: buildFaviconApiUrl(domain) };
        }
        // fallback to default if no domain available
    }

    if (config.mode === 'custom' && config.url) {
        return { type: 'image', url: config.url };
    }

    // default mode or fallback
    if (provider.type === 'google') return { type: 'svg', name: 'google' };
    if (provider.type === 'github') return { type: 'svg', name: 'github' };
    return { type: 'svg', name: 'link' };
}
