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
            proxies: Array.isArray(config.proxies) ? config.proxies : [],
            'proxy-groups': Array.isArray(config['proxy-groups']) ? config['proxy-groups'] : [],
            rules: Array.isArray(config.rules) ? config.rules : [],
            ...config
        };
    } catch (e) {
        console.error('Failed to parse subscription cache:', e);
        return null;
    }
}
