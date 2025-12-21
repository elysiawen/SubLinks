import { redis } from './redis';
import yaml from 'js-yaml';

export interface Proxy {
    name: string;
    type: string;
    server?: string;
    port?: number;
    cipher?: string;
    uuid?: string;
    // Add other common fields as needed
    [key: string]: any;
}

export interface ProxyGroup {
    name: string;
    type: string;
    proxies: string[];
    [key: string]: any;
}

export interface ClashConfig {
    proxies: Proxy[];
    'proxy-groups': ProxyGroup[];
    rules: string[];
    [key: string]: any;
}

export async function getParsedConfig(): Promise<ClashConfig | null> {
    try {
        const content = await redis.get('cache:subscription');
        if (!content) return null;

        const config = yaml.load(content) as ClashConfig;

        // Basic validation/normalization
        return {
            ...config,
            proxies: Array.isArray(config.proxies) ? config.proxies : [],
            'proxy-groups': Array.isArray(config['proxy-groups']) ? config['proxy-groups'] : [],
            rules: Array.isArray(config.rules) ? config.rules : []
        };
    } catch (e) {
        console.error('Failed to parse subscription cache:', e);
        return null;
    }
}

export async function refreshUpstreamCache() {
    try {
        const configStr = await redis.get('config:global');
        const config = configStr ? JSON.parse(configStr) : {};

        const upstreamUrl = config.upstreamUrl;
        // Default 24h
        const cacheDuration = (config.cacheDuration || 24) * 3600;

        if (!upstreamUrl) {
            console.warn('No upstream URL configured, skipping refresh.');
            return false;
        }

        const res = await fetch(upstreamUrl, {
            headers: {
                'User-Agent': 'Clash/Vercel-Sub-Manager'
            }
        });

        if (!res.ok) {
            console.error(`Upstream Fetch Failed: ${res.status}`);
            return false;
        }

        const content = await res.text();
        await redis.set('cache:subscription', content, 'EX', cacheDuration);
        console.log('Upstream cache refreshed successfully.');
        return true;

    } catch (e) {
        console.error('Failed to refresh upstream cache:', e);
        return false;
    }
}
