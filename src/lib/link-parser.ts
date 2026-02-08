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
        let url: URL;
        try {
            url = new URL(link);
        } catch (e) {
            return null;
        }

        const protocol = url.protocol.replace(':', '').toLowerCase();
        const hashName = decodeURIComponent(url.hash.substring(1));

        if (protocol === 'hysteria2' || protocol === 'hy2') {
            return parseHysteria2(url, hashName);
        } else if (protocol === 'vmess') {
            return parseVmess(link);
        } else if (protocol === 'vless') {
            return parseVless(url, hashName);
        } else if (protocol === 'trojan') {
            return parseTrojan(url, hashName);
        } else if (protocol === 'ss') {
            return parseShadowsocks(url, hashName);
        }

        return null;
    } catch (e) {
        console.warn(`Failed to parse link: ${link}`, e);
        return null;
    }
}

function parseHysteria2(url: URL, name: string): ProxyConfig {
    const config: ProxyConfig = {
        name: name || `Hysteria2 ${url.hostname}`,
        type: 'hysteria2',
        server: url.hostname,
        port: parseInt(url.port) || 443,
        password: url.username,
        ...parseQueryParams(url.searchParams)
    };
    return config;
}

function parseVmess(link: string): ProxyConfig | null {
    try {
        const base64Part = link.replace(/^vmess:\/\//i, '');
        const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
        const vmessObj = JSON.parse(decoded);

        return {
            name: vmessObj.ps || `Vmess ${vmessObj.add}`,
            type: 'vmess',
            server: vmessObj.add,
            port: parseInt(vmessObj.port),
            uuid: vmessObj.id,
            alterId: parseInt(vmessObj.aid) || 0,
            cipher: vmessObj.scy || 'auto',
            network: vmessObj.net || 'tcp',
            tls: vmessObj.tls === 'tls',
            servername: vmessObj.sni || vmessObj.host,
            'ws-opts': vmessObj.net === 'ws' ? {
                path: vmessObj.path,
                headers: vmessObj.host ? { Host: vmessObj.host } : undefined
            } : undefined,
            // Add other transport options if needed (h2, grpc, etc)
        };
    } catch (e) {
        console.warn('Failed to parse vmess', e);
        return null;
    }
}

function parseVless(url: URL, name: string): ProxyConfig {
    const config: ProxyConfig = {
        name: name || `Vless ${url.hostname}`,
        type: 'vless',
        server: url.hostname,
        port: parseInt(url.port) || 443,
        uuid: url.username,
        cipher: 'auto',
        tls: url.searchParams.get('security') === 'tls',
        'flow': url.searchParams.get('flow') || undefined,
        servername: url.searchParams.get('sni'),
        network: url.searchParams.get('type') || 'tcp',
    };

    if (config.network === 'ws') {
        config['ws-opts'] = {
            path: url.searchParams.get('path'),
            headers: url.searchParams.get('host') ? { Host: url.searchParams.get('host') } : undefined
        };
    }

    // Reality check
    if (url.searchParams.get('security') === 'reality') {
        config.tls = true;
        config.reality = true; // Clash Meta specific?
        config['client-fingerprint'] = url.searchParams.get('fp');
        config['public-key'] = url.searchParams.get('pbk');
        config['short-id'] = url.searchParams.get('sid');
    }

    return config;
}

function parseTrojan(url: URL, name: string): ProxyConfig {
    const config: ProxyConfig = {
        name: name || `Trojan ${url.hostname}`,
        type: 'trojan',
        server: url.hostname,
        port: parseInt(url.port) || 443,
        password: url.username,
        sni: url.searchParams.get('sni'),
        'skip-cert-verify': url.searchParams.get('allowInsecure') === '1',
    };
    return config;
}

function parseShadowsocks(url: URL, name: string): ProxyConfig | null {
    // SS format can be complex (SIP002 or legacy base64)
    // Legacy: ss://BASE64(method:password)@host:port#name
    // SIP002: ss://BASE64(method:password@host:port)#name  <-- Not exactly, SIP002 is ss://user:pass@host:port ideally
    // Actually standard SIP002: ss://base64(method:password)@hostname:port

    let method = '';
    let password = '';
    let server = url.hostname;
    let port = parseInt(url.port);

    if (url.username) {
        // user:pass format directly in URL? 
        // ss://method:pass@host:port
        // Browser/URL parser puts method in username, pass in password usually?
        // No, `user:pass`
        if (url.password) {
            method = url.username;
            password = url.password;
        } else {
            // Possibly base64 encoded user info in username?
            try {
                const decoded = Buffer.from(url.username, 'base64').toString('utf-8');
                const parts = decoded.split(':');
                if (parts.length >= 2) {
                    method = parts[0];
                    password = parts.slice(1).join(':');
                } else {
                    // Could be complete base64 of method:pass@host:port ??
                    // Let's stick to standard SIP002 parsing if possible
                    return null;
                }
            } catch {
                return null;
            }
        }
    } else {
        // host logic might be messed up if it's all base64
        // Check if hostname is actually a base64 string
        if (!url.port && !url.pathname) {
            try {
                // Try decoding the whole hostname part as base64?
                // ss://BASE64#name
                const decoded = Buffer.from(url.hostname, 'base64').toString('utf-8');
                // decoded should be method:password@server:port
                const atIndex = decoded.lastIndexOf('@');
                if (atIndex !== -1) {
                    const userInfo = decoded.substring(0, atIndex);
                    const address = decoded.substring(atIndex + 1);

                    const userParts = userInfo.split(':');
                    method = userParts[0];
                    password = userParts.slice(1).join(':');

                    const addrParts = address.split(':');
                    server = addrParts[0];
                    port = parseInt(addrParts[1]);
                }
            } catch {
                return null;
            }
        }
    }

    if (!method || !password || !server || !port) return null;

    return {
        name: name || `SS ${server}`,
        type: 'ss',
        server,
        port,
        cipher: method,
        password,
        plugin: url.searchParams.get('plugin'),
        'plugin-opts': url.searchParams.get('plugin-opts') ? JSON.parse(decodeURIComponent(url.searchParams.get('plugin-opts') || '{}')) : undefined
    };
}

function parseQueryParams(params: URLSearchParams): any {
    const config: any = {};
    if (params.has('sni')) config.sni = params.get('sni');
    if (params.has('insecure')) config['skip-cert-verify'] = params.get('insecure') === '1';
    return config;
}

/**
 * Parse a Base64 encoded list of links OR a plain text list of links
 */
export function parseBase64Links(content: string): ProxyConfig[] {
    try {
        const trimmed = content.trim();
        let decoded = trimmed;

        // Try decoding as base64 first, but only if it looks like it (no spaces, etc)
        // Or just blindly try decoding. If result consists of readable text with known protocols, valid.
        // If fail, fall back to original text.
        try {
            const possibleDecoded = Buffer.from(trimmed, 'base64').toString('utf-8');
            // Heuristic to check if it decoded meaningfully: 
            // - Contains standard protocols
            // - Doesn't contain too many binary chars
            if (possibleDecoded.includes('://') || possibleDecoded.match(/vmess:/i)) {
                decoded = possibleDecoded;
            }
        } catch {
            // Not base64, stick to original
        }

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
        console.error('Failed to parse links:', e);
        return [];
    }
}
