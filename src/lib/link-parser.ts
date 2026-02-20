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
        } else if (protocol === 'ssr') {
            return parseShadowsocksR(link);
        }

        return null;
    } catch (e) {
        console.warn(`Failed to parse link: ${link}`, e);
        return null;
    }
}

function parseHysteria2(url: URL, name: string): ProxyConfig {
    const sni = url.searchParams.get('sni') || url.searchParams.get('peer');
    const insecure = url.searchParams.get('insecure') || url.searchParams.get('allowInsecure') || url.searchParams.get('allowinsecure');

    const config: ProxyConfig = {
        name: name || `Hysteria2 ${url.hostname}`,
        type: 'hysteria2',
        server: url.hostname,
        port: parseInt(url.port) || 443,
        password: url.username,
        sni: sni || undefined,
        'skip-cert-verify': insecure === '1' || insecure === 'true' || undefined,
        obfs: url.searchParams.get('obfs') || undefined,
        'obfs-password': url.searchParams.get('obfs-password') || undefined,
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
    const sni = url.searchParams.get('sni') || url.searchParams.get('peer');
    const insecure = url.searchParams.get('insecure') || url.searchParams.get('allowInsecure') || url.searchParams.get('allowinsecure');
    const network = url.searchParams.get('type') || url.searchParams.get('network') || 'tcp';

    const config: ProxyConfig = {
        name: name || `Vless ${url.hostname}`,
        type: 'vless',
        server: url.hostname,
        port: parseInt(url.port) || 443,
        uuid: url.username,
        cipher: 'auto',
        tls: url.searchParams.get('security') === 'tls' || url.searchParams.get('security') === 'reality',
        'skip-cert-verify': insecure === '1' || insecure === 'true' || undefined,
        'flow': url.searchParams.get('flow') || undefined,
        servername: sni || undefined,
        network: network,
    };

    if (config.network === 'ws') {
        config['ws-opts'] = {
            path: url.searchParams.get('path') || '/',
            headers: (url.searchParams.get('host') || sni) ? { Host: url.searchParams.get('host') || sni } : undefined
        };
    } else if (config.network === 'grpc') {
        config['grpc-opts'] = {
            'grpc-service-name': url.searchParams.get('serviceName') || url.searchParams.get('path') || '',
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
    const sni = url.searchParams.get('sni') || url.searchParams.get('peer');
    const insecure = url.searchParams.get('insecure') || url.searchParams.get('allowInsecure') || url.searchParams.get('allowinsecure');
    const network = url.searchParams.get('type') || url.searchParams.get('network') || 'tcp';

    const config: ProxyConfig = {
        name: name || `Trojan ${url.hostname}`,
        type: 'trojan',
        server: url.hostname,
        port: parseInt(url.port) || 443,
        password: url.username,
        sni: sni || undefined,
        'skip-cert-verify': insecure === '1' || insecure === 'true' || undefined,
        network: network !== 'tcp' ? network : undefined,
    };

    if (config.network === 'ws') {
        config['ws-opts'] = {
            path: url.searchParams.get('path') || '/',
            headers: (url.searchParams.get('host') || sni) ? { Host: url.searchParams.get('host') || sni } : undefined
        };
    } else if (config.network === 'grpc') {
        config['grpc-opts'] = {
            'grpc-service-name': url.searchParams.get('serviceName') || url.searchParams.get('path') || '',
        };
    }

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

function parseShadowsocksR(link: string): ProxyConfig | null {
    try {
        const base64Part = link.replace(/^ssr:\/\//i, '');
        // SSR base64 is often url-safe
        let b64 = base64Part.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';

        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        // format: server:port:protocol:method:obfs:password_base64/?params

        const parts = decoded.split('/');
        const mainPart = parts[0];
        const paramPart = parts.length > 1 ? parts.slice(1).join('/') : '';

        const mainParts = mainPart.split(':');
        if (mainParts.length < 6) return null;

        const server = mainParts[0];
        const port = parseInt(mainParts[1]);
        const protocol = mainParts[2];
        const method = mainParts[3];
        const obfs = mainParts[4];

        let passwordB64 = mainParts[5];
        passwordB64 = passwordB64.replace(/-/g, '+').replace(/_/g, '/');
        while (passwordB64.length % 4 !== 0) passwordB64 += '=';
        const password = Buffer.from(passwordB64, 'base64').toString('utf-8');

        const config: ProxyConfig = {
            name: `SSR ${server}`,
            type: 'ssr',
            server,
            port,
            cipher: method,
            password,
            protocol,
            obfs,
        };

        if (paramPart && paramPart.startsWith('?')) {
            const qs = paramPart.substring(1);
            const params = new URLSearchParams(qs);

            if (params.has('obfsparam')) {
                let p = params.get('obfsparam')!;
                p = p.replace(/-/g, '+').replace(/_/g, '/');
                while (p.length % 4 !== 0) p += '=';
                config['obfs-param'] = Buffer.from(p, 'base64').toString('utf-8');
            }
            if (params.has('protoparam')) {
                let p = params.get('protoparam')!;
                p = p.replace(/-/g, '+').replace(/_/g, '/');
                while (p.length % 4 !== 0) p += '=';
                config['protocol-param'] = Buffer.from(p, 'base64').toString('utf-8');
            }
            if (params.has('remarks')) {
                let p = params.get('remarks')!;
                p = p.replace(/-/g, '+').replace(/_/g, '/');
                while (p.length % 4 !== 0) p += '=';
                config.name = Buffer.from(p, 'base64').toString('utf-8');
            }
        }

        return config;
    } catch (e) {
        console.warn('Failed to parse ssr', e);
        return null;
    }
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
