import { UaRule, UaFilterConfig, UaMatchType } from './database/interface';

/**
 * Match a User-Agent string against a UA rule
 */
export function matchUaRule(ua: string, rule: UaRule): boolean {
    const { pattern, matchType } = rule;

    try {
        switch (matchType) {
            case 'contains':
                return ua.includes(pattern);
            case 'startsWith':
                return ua.startsWith(pattern);
            case 'endsWith':
                return ua.endsWith(pattern);
            case 'exact':
                return ua === pattern;
            case 'regex':
                try {
                    const regex = new RegExp(pattern);
                    return regex.test(ua);
                } catch {
                    console.error(`Invalid regex pattern: ${pattern}`);
                    return false;
                }
            default:
                return false;
        }
    } catch (error) {
        console.error(`Error matching UA rule:`, error);
        return false;
    }
}

/**
 * Check if a User-Agent passes the filter configuration
 * @returns true if allowed, false if blocked
 */
export function checkUaFilter(ua: string, config: UaFilterConfig): boolean {
    if (!config.enabled) return true; // Not enabled, allow all
    if (!config.rules || config.rules.length === 0) return true; // No rules, allow all

    const matched = config.rules.some(rule => matchUaRule(ua, rule));

    // Blacklist mode: matched = blocked
    if (config.mode === 'blacklist') {
        return !matched;
    }

    // Whitelist mode: matched = allowed
    return matched;
}

/**
 * UA Presets for quick configuration
 */
export const UA_PRESETS: Record<string, UaRule> = {
    // Proxy clients (recommended for whitelist)
    clash: { pattern: 'clash', matchType: 'contains', description: 'Clash 系列客户端' },
    clashMeta: { pattern: 'ClashMeta', matchType: 'contains', description: 'Clash Meta' },
    clashVerge: { pattern: 'clash-verge', matchType: 'contains', description: 'Clash Verge' },
    shadowrocket: { pattern: 'Shadowrocket', matchType: 'contains', description: 'Shadowrocket' },
    quantumult: { pattern: 'Quantumult', matchType: 'contains', description: 'Quantumult X' },
    surge: { pattern: 'Surge', matchType: 'contains', description: 'Surge' },
    v2rayN: { pattern: 'v2rayN', matchType: 'contains', description: 'v2rayN' },
    v2rayNG: { pattern: 'v2rayNG', matchType: 'contains', description: 'v2rayNG (Android)' },
    stash: { pattern: 'Stash', matchType: 'contains', description: 'Stash' },
    loon: { pattern: 'Loon', matchType: 'contains', description: 'Loon' },

    // Browsers (optional for whitelist)
    chrome: { pattern: 'Chrome/', matchType: 'contains', description: 'Chrome 浏览器' },
    firefox: { pattern: 'Firefox/', matchType: 'contains', description: 'Firefox 浏览器' },
    safari: { pattern: 'Safari/', matchType: 'contains', description: 'Safari 浏览器' },
    edge: { pattern: 'Edg/', matchType: 'contains', description: 'Edge 浏览器' },
    opera: { pattern: 'OPR/', matchType: 'contains', description: 'Opera 浏览器' },

    // Social app browsers (recommended for blacklist, but already blocked in middleware)
    wechat: { pattern: 'MicroMessenger', matchType: 'contains', description: '微信内置浏览器' },
    qq: { pattern: 'QQ/', matchType: 'contains', description: 'QQ 内置浏览器' },
    weibo: { pattern: 'Weibo', matchType: 'contains', description: '微博内置浏览器' },
    douyin: { pattern: 'aweme', matchType: 'contains', description: '抖音内置浏览器' },

    // Crawlers and automation (recommended for blacklist)
    curl: { pattern: 'curl/', matchType: 'startsWith', description: 'cURL' },
    wget: { pattern: 'Wget/', matchType: 'startsWith', description: 'Wget' },
    pythonRequests: { pattern: 'python-requests', matchType: 'contains', description: 'Python Requests' },
    goHttp: { pattern: 'Go-http-client', matchType: 'contains', description: 'Go HTTP Client' },
    axios: { pattern: 'axios/', matchType: 'contains', description: 'Axios (Node.js)' },
    postman: { pattern: 'PostmanRuntime', matchType: 'contains', description: 'Postman' },
};

/**
 * Get preset rules by category
 */
export function getPresetsByCategory(category: 'proxy' | 'browser' | 'social' | 'crawler'): UaRule[] {
    switch (category) {
        case 'proxy':
            return [
                UA_PRESETS.clash,
                UA_PRESETS.clashMeta,
                UA_PRESETS.clashVerge,
                UA_PRESETS.shadowrocket,
                UA_PRESETS.quantumult,
                UA_PRESETS.surge,
                UA_PRESETS.v2rayN,
                UA_PRESETS.v2rayNG,
                UA_PRESETS.stash,
                UA_PRESETS.loon,
            ];
        case 'browser':
            return [
                UA_PRESETS.chrome,
                UA_PRESETS.firefox,
                UA_PRESETS.safari,
                UA_PRESETS.edge,
                UA_PRESETS.opera,
            ];
        case 'social':
            return [
                UA_PRESETS.wechat,
                UA_PRESETS.qq,
                UA_PRESETS.weibo,
                UA_PRESETS.douyin,
            ];
        case 'crawler':
            return [
                UA_PRESETS.curl,
                UA_PRESETS.wget,
                UA_PRESETS.pythonRequests,
                UA_PRESETS.goHttp,
                UA_PRESETS.axios,
                UA_PRESETS.postman,
            ];
        default:
            return [];
    }
}

/**
 * Default UA filter configurations
 */
export const DEFAULT_UA_FILTER: UaFilterConfig = {
    mode: 'blacklist',
    rules: [],  // Empty rules, middleware already blocks WeChat/QQ
    enabled: false,  // Disabled by default
};

export const RECOMMENDED_BLACKLIST: UaFilterConfig = {
    mode: 'blacklist',
    rules: getPresetsByCategory('crawler'),
    enabled: true,
};

export const RECOMMENDED_WHITELIST: UaFilterConfig = {
    mode: 'whitelist',
    rules: [
        ...getPresetsByCategory('proxy'),
        ...getPresetsByCategory('browser'),
    ],
    enabled: true,
};
