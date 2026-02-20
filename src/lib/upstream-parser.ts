import { db } from './db';
import yaml from 'js-yaml';
import { nanoid } from 'nanoid';
import type { Proxy, ProxyGroup, Rule } from './database/interface';
import { parseBase64Links } from './link-parser';

/**
 * Parse upstream YAML content and store structured data to database
 */
export async function parseAndStoreUpstream(
    yamlContent: string,
    sourceName: string = 'upstream',
    logger?: (msg: string, type?: 'info' | 'success' | 'error') => void
): Promise<void> {
    try {
        let config: any = null;
        let isRawList = false;

        try {
            config = yaml.load(yamlContent);
        } catch (e) {
            // Not valid YAML, treat as raw list
            config = yamlContent;
        }

        // Handle Base64 encoded node list or raw text list
        if (typeof config === 'string' || !config || (typeof config === 'object' && !config.proxies && !config['proxy-groups'])) {
            const parsedProxies = parseBase64Links(yamlContent);
            if (parsedProxies.length > 0) {
                const msg = `  ℹ️ Detected node list with ${parsedProxies.length} proxies`;
                console.log(msg);
                if (logger) logger(msg, 'info');
                config = { proxies: parsedProxies };
                isRawList = true;
            } else if (typeof config === 'string') {
                // If parsing failed and it was a string, valid config is null
                config = { proxies: [] };
            }
        }

        const startMsg = `📦 Parsing upstream subscription data from [${sourceName}]...`;
        console.log(startMsg);
        if (logger) logger(startMsg, 'info');

        // Track saved proxies for fallback group
        let savedProxyNames: string[] = [];

        // 1. Store Proxies
        if (config && config.proxies && Array.isArray(config.proxies)) {
            const proxies: Proxy[] = config.proxies.map((p: any) => ({
                id: nanoid(),
                name: p.name || 'Unnamed',
                type: p.type || 'unknown',
                server: p.server,
                port: p.port,
                config: p, // Store full config as JSON
                source: sourceName, // Use source name
                createdAt: Date.now(),
            }));

            await db.saveProxies(proxies);
            savedProxyNames = proxies.map(p => p.name);

            const proxyMsg = `  ✓ Saved ${proxies.length} proxies from [${sourceName}]`;
            console.log(proxyMsg);
            if (logger) logger(proxyMsg, 'success');
        }

        // 2. Store Proxy Groups
        let hasGroups = false;
        if (config && config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
            const groups: ProxyGroup[] = config['proxy-groups'].map((g: any, index: number) => {
                const { name, type, proxies, ...otherConfig } = g;
                return {
                    id: nanoid(),
                    name: name || 'Unnamed Group',
                    type: type || 'select',
                    proxies: proxies || [],
                    config: otherConfig, // Store other fields (url, interval, etc.)
                    source: sourceName, // Use source name
                    priority: index,
                    createdAt: Date.now(),
                };
            });

            if (groups.length > 0) {
                await db.saveProxyGroups(groups);
                hasGroups = true;
                const groupMsg = `  ✓ Saved ${groups.length} proxy groups from [${sourceName}]`;
                console.log(groupMsg);
                if (logger) logger(groupMsg, 'success');
            }
        }

        // Fallback: Create default group if no groups exist but proxies do
        if (!hasGroups && savedProxyNames.length > 0) {
            const defaultGroup: ProxyGroup = {
                id: nanoid(),
                name: sourceName, // Use source name as group name
                type: 'select',
                proxies: [`SOURCE:${sourceName}`], // Dynamic: Select all from this source
                config: {},
                source: sourceName,
                priority: 0,
                createdAt: Date.now()
            };

            await db.saveProxyGroups([defaultGroup]);
            const fallbackMsg = `  ℹ️ Created default proxy group [${sourceName}] with dynamic node selection`;
            console.log(fallbackMsg);
            if (logger) logger(fallbackMsg, 'info');
        }

        // 3. Store Rules
        if (config && config.rules && Array.isArray(config.rules)) {
            const rules: Rule[] = config.rules.map((r: string, index: number) => ({
                id: nanoid(),
                ruleText: r,
                priority: index,
                source: sourceName, // Use source name
                createdAt: Date.now(),
            }));

            await db.saveRules(rules);
            const ruleMsg = `  ✓ Saved ${rules.length} rules from [${sourceName}]`;
            console.log(ruleMsg);
            if (logger) logger(ruleMsg, 'success');
        }

        // 4. Store Other Config Items (dns, tun, experimental, etc.)
        if (config && typeof config === 'object') {
            const excludeKeys = ['proxies', 'proxy-groups', 'rules'];
            for (const [key, value] of Object.entries(config)) {
                if (!excludeKeys.includes(key)) {
                    // Save config item with source namespacing
                    await db.saveUpstreamConfigItem(key, value, sourceName);
                }
            }
        }

        const doneMsg = `Upstream data from [${sourceName}] parsed and stored successfully`;
        console.log(doneMsg);
        if (logger) logger(doneMsg, 'success');
    } catch (error) {
        const errorMsg = `Failed to parse upstream data from [${sourceName}]: ${error}`;
        console.error(errorMsg);
        if (logger) logger(errorMsg, 'error');
        throw error;
    }
}

/**
 * Parse content and return structured data WITHOUT saving to database.
 * Used by the wizard to preview parsed results before committing.
 */
export function parseContentPreview(content: string): {
    proxies: any[];
    groups: any[];
    rules: string[];
} {
    const result = { proxies: [] as any[], groups: [] as any[], rules: [] as string[] };

    try {
        let config: any = null;

        try {
            config = yaml.load(content);
        } catch (e) {
            config = content;
        }

        // Handle Base64 encoded node list or raw text list
        if (typeof config === 'string' || !config || (typeof config === 'object' && !config.proxies && !config['proxy-groups'])) {
            const parsedProxies = parseBase64Links(content);
            if (parsedProxies.length > 0) {
                config = { proxies: parsedProxies };
            } else {
                return result;
            }
        }

        // Extract proxies
        if (config && config.proxies && Array.isArray(config.proxies)) {
            result.proxies = config.proxies.map((p: any) => ({
                name: p.name || 'Unnamed',
                type: p.type || 'unknown',
                server: p.server,
                port: p.port,
                config: p,
            }));
        }

        // Extract proxy groups
        if (config && config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
            result.groups = config['proxy-groups'].map((g: any) => ({
                name: g.name || 'Unnamed Group',
                type: g.type || 'select',
                proxies: g.proxies || [],
            }));
        }

        // Extract rules
        if (config && config.rules && Array.isArray(config.rules)) {
            result.rules = config.rules;
        }
    } catch (e) {
        console.error('parseContentPreview error:', e);
    }

    return result;
}
