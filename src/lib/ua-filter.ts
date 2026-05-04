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
 * UA Presets for quick configuration.
 * Description values are translation keys under 'common.uaPresets'.
 * Use t(key) to get the localized description.
 */
export const UA_PRESETS: Record<string, UaRule> = {
    // Proxy clients (recommended for whitelist)
    clash: { pattern: 'clash', matchType: 'contains', description: 'uaPresets.clash' },
    clashMeta: { pattern: 'ClashMeta', matchType: 'contains', description: 'uaPresets.clashMeta' },
    clashVerge: { pattern: 'clash-verge', matchType: 'contains', description: 'uaPresets.clashVerge' },
    shadowrocket: { pattern: 'Shadowrocket', matchType: 'contains', description: 'uaPresets.shadowrocket' },
    quantumult: { pattern: 'Quantumult', matchType: 'contains', description: 'uaPresets.quantumult' },
    surge: { pattern: 'Surge', matchType: 'contains', description: 'uaPresets.surge' },
    v2rayN: { pattern: 'v2rayN', matchType: 'contains', description: 'uaPresets.v2rayN' },
    v2rayNG: { pattern: 'v2rayNG', matchType: 'contains', description: 'uaPresets.v2rayNG' },
    stash: { pattern: 'Stash', matchType: 'contains', description: 'uaPresets.stash' },
    loon: { pattern: 'Loon', matchType: 'contains', description: 'uaPresets.loon' },

    // Browsers (optional for whitelist)
    chrome: { pattern: 'Chrome/', matchType: 'contains', description: 'uaPresets.chrome' },
    firefox: { pattern: 'Firefox/', matchType: 'contains', description: 'uaPresets.firefox' },
    safari: { pattern: 'Safari/', matchType: 'contains', description: 'uaPresets.safari' },
    edge: { pattern: 'Edg/', matchType: 'contains', description: 'uaPresets.edge' },
    opera: { pattern: 'OPR/', matchType: 'contains', description: 'uaPresets.opera' },

    // Social app browsers (recommended for blacklist, but already blocked in middleware)
    wechat: { pattern: 'MicroMessenger', matchType: 'contains', description: 'uaPresets.wechat' },
    qq: { pattern: 'QQ/', matchType: 'contains', description: 'uaPresets.qq' },
    weibo: { pattern: 'Weibo', matchType: 'contains', description: 'uaPresets.weibo' },
    douyin: { pattern: 'aweme', matchType: 'contains', description: 'uaPresets.douyin' },

    // Crawlers and automation (recommended for blacklist)
    curl: { pattern: 'curl/', matchType: 'startsWith', description: 'uaPresets.curl' },
    wget: { pattern: 'Wget/', matchType: 'startsWith', description: 'uaPresets.wget' },
    pythonRequests: { pattern: 'python-requests', matchType: 'contains', description: 'uaPresets.pythonRequests' },
    goHttp: { pattern: 'Go-http-client', matchType: 'contains', description: 'uaPresets.goHttp' },
    axios: { pattern: 'axios/', matchType: 'contains', description: 'uaPresets.axios' },
    postman: { pattern: 'PostmanRuntime', matchType: 'contains', description: 'uaPresets.postman' },
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
