import { nanoid } from 'nanoid';

interface ProxyConfig {
    name: string;
    type: string;
    server: string;
    port: number;
    [key: string]: any;
}

/**
 * Parse a single link into a Clash proxy config
 */
export function parseLink(link: string): ProxyConfig | null {
    try {
        const url = new URL(link);
        const protocol = url.protocol.replace(':', '');
        const name = decodeURIComponent(url.hash.substring(1));

        if (protocol === 'anytls' || protocol === 'hysteria2') {
            // Hysteria 2
            // Format: anytls://password@server:port?sni=...&insecure=...#name
            const config: ProxyConfig = {
                name: name || 'Unnamed Hysteria2',
                type: 'hysteria2',
                server: url.hostname,
                port: parseInt(url.port) || 443,
                password: url.username,
                // Parse query params
                ...parseQueryParams(url.searchParams)
            };
            return config;
        }

        // Add other protocols here if needed (vmess, vless, trojan, etc)

        return null;
    } catch (e) {
        console.warn(`Failed to parse link: ${link}`, e);
        return null;
    }
}

function parseQueryParams(params: URLSearchParams): any {
    const config: any = {};

    if (params.has('sni')) config.sni = params.get('sni');
    if (params.has('insecure')) config['skip-cert-verify'] = params.get('insecure') === '1';

    // Obfuscation (legacy field mapping if needed, usually hysteria2 uses specific obfuscation fields if valid)
    // anytls usually implies standard Hysteria 2.

    return config;
}

/**
 * Parse a Base64 encoded list of links
 */
export function parseBase64Links(content: string): ProxyConfig[] {
    try {
        // 1. Decode Base64
        // Check if content looks like Base64 (no spaces, valid chars)
        // Or just try to decode.
        // We trim first.
        const trimmed = content.trim();
        // Simple check: if it contains spaces or newlines, it might NOT be pure Base64 unless it is ignored?
        // Usually subscriptions are pure base64.

        let decoded = '';
        try {
            decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
        } catch {
            return [];
        }

        // 2. Split by newline
        const lines = decoded.split(/[\r\n]+/).map(l => l.trim()).filter(l => l);

        const proxies: ProxyConfig[] = [];

        for (const line of lines) {
            if (line.includes('://')) {
                const proxy = parseLink(line);
                if (proxy) {
                    proxies.push(proxy);
                }
            }
        }

        return proxies;
    } catch (e) {
        console.error('Failed to parse base64 links:', e);
        return [];
    }
}
