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
        let config: any = yaml.load(yamlContent);

        // Handle Base64 encoded node list (string output from yaml.load)
        if (typeof config === 'string') {
            const parsedProxies = parseBase64Links(yamlContent);
            if (parsedProxies.length > 0) {
                const msg = `  ℹ️ Detected Base64 node list with ${parsedProxies.length} proxies`;
                console.log(msg);
                if (logger) logger(msg, 'info');
                config = { proxies: parsedProxies };
            }
        }

        const startMsg = `📦 Parsing upstream subscription data from [${sourceName}]...`;
        console.log(startMsg);
        if (logger) logger(startMsg, 'info');

        // Don't clear - allow merging from multiple sources

        // 1. Store Proxies
        if (config.proxies && Array.isArray(config.proxies)) {
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
            const proxyMsg = `  ✓ Saved ${proxies.length} proxies from [${sourceName}]`;
            console.log(proxyMsg);
            if (logger) logger(proxyMsg, 'success');
        }

        // 2. Store Proxy Groups
        if (config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
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

            await db.saveProxyGroups(groups);
            const groupMsg = `  ✓ Saved ${groups.length} proxy groups from [${sourceName}]`;
            console.log(groupMsg);
            if (logger) logger(groupMsg, 'success');
        }

        // 3. Store Rules
        if (config.rules && Array.isArray(config.rules)) {
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
        const excludeKeys = ['proxies', 'proxy-groups', 'rules'];
        for (const [key, value] of Object.entries(config)) {
            if (!excludeKeys.includes(key)) {
                // Save config item with source namespacing
                await db.saveUpstreamConfigItem(key, value, sourceName);
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
