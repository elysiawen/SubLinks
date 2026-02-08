import { db } from './db';
import yaml from 'js-yaml';
import type { SubData } from './database/interface';

/**
 * Build subscription YAML from database structured data
 */
export async function buildSubscriptionYaml(sub: SubData & { token: string }): Promise<string | null> {
    try {
        console.log('📋 Building subscription for:', sub.remark || sub.token);
        console.log('   Custom rules:', sub.customRules ? `${sub.customRules.split('\n').length} lines` : 'none');
        console.log('   Selected sources:', sub.selectedSources || 'all');

        const config: any = {};

        // 1. Get enabled status of sources
        const allSources = await db.getUpstreamSources();
        const enabledSources = new Set(allSources.filter(s => s.enabled !== false).map(s => s.name));

        // Calculate effective sources (user selected AND enabled)
        let effectiveSources: string[] = [];
        if (sub.selectedSources && sub.selectedSources.length > 0) {
            effectiveSources = sub.selectedSources.filter(s => enabledSources.has(s));

            // If user selected sources but NONE are enabled, return null (signal for 503)
            if (effectiveSources.length === 0) {
                console.warn(`⚠️ All selected sources are disabled for subscription: ${sub.token}`);
                return null;
            }
        } else {
            // If no selection (all), use all enabled sources
            effectiveSources = Array.from(enabledSources);
        }

        console.log(`   ✓ Effective sources: ${effectiveSources.join(', ')}`);

        // 1.1 Pre-fetch custom groups (Logic for implicit sources removed per user request)
        let groups: any[] | null = null;
        if (sub.groupId && sub.groupId !== 'default') {
            const user = await db.getUser(sub.username);
            if (user) {
                const customGroup = await db.getCustomGroup(sub.groupId, user.id);
                if (customGroup) {
                    const customGroups = yaml.load(customGroup.content);
                    if (Array.isArray(customGroups)) {
                        groups = customGroups;
                    }
                }
            }
        }

        // Define sources for different purposes
        const configSources = effectiveSources; // Only explicitly selected sources contribute to global config
        const proxySources = effectiveSources;  // Only explicitly selected sources contribute proxies

        // 2. Get Other Upstream Config (dns, tun, etc.) - using CONFIG sources
        // Fetch isolated config for effective sources (merged)
        const upstreamConfig = await db.getUpstreamConfig(configSources);
        Object.assign(config, upstreamConfig);

        // 2. Get Proxies - filter by PROXY sources
        let allProxies = await db.getProxies();

        // Filter by proxy sources (explicit only)
        allProxies = allProxies.filter(p => proxySources.includes(p.source));
        console.log(`   ✓ Filtered proxies to ${allProxies.length} from proxy sources`);

        // Format proxies with proper field ordering
        config.proxies = allProxies.map(p => {
            const proxy = p.config;
            const formatted: any = {};

            // Always include name and type first
            formatted.name = proxy.name;
            formatted.type = proxy.type;

            // Add common fields in standard order
            if (proxy.server) formatted.server = proxy.server;
            if (proxy.port) formatted.port = proxy.port;

            // Type-specific fields
            if (proxy.type === 'ss' || proxy.type === 'ssr') {
                if (proxy.cipher) formatted.cipher = proxy.cipher;
                if (proxy.password) formatted.password = proxy.password;
            }

            if (proxy.type === 'ssr') {
                if (proxy.protocol) formatted.protocol = proxy.protocol;
                if (proxy['protocol-param']) formatted['protocol-param'] = proxy['protocol-param'];
                if (proxy.obfs) formatted.obfs = proxy.obfs;
                if (proxy['obfs-param']) formatted['obfs-param'] = proxy['obfs-param'];
            }

            if (proxy.type === 'vmess') {
                if (proxy.uuid) formatted.uuid = proxy.uuid;
                if (proxy.alterId !== undefined) formatted.alterId = proxy.alterId;
                if (proxy.cipher) formatted.cipher = proxy.cipher;
            }

            if (proxy.type === 'trojan') {
                if (proxy.password) formatted.password = proxy.password;
                if (proxy.sni) formatted.sni = proxy.sni;
                if (proxy['skip-cert-verify'] !== undefined) formatted['skip-cert-verify'] = proxy['skip-cert-verify'];
            }

            if (proxy.type === 'vless') {
                if (proxy.uuid) formatted.uuid = proxy.uuid;
                if (proxy.flow) formatted.flow = proxy.flow;
            }

            // Add any remaining fields that weren't explicitly handled
            for (const [key, value] of Object.entries(proxy)) {
                if (!formatted.hasOwnProperty(key) && key !== 'name' && key !== 'type') {
                    formatted[key] = value;
                }
            }

            // UDP support (usually at the end)
            if (proxy.udp !== undefined) formatted.udp = proxy.udp;

            return formatted;
        });

        // 3. Get Proxy Groups (If not already fetched as custom)
        if (!groups) {
            // Use upstream groups - filter by effective sources
            let upstreamGroups = await db.getProxyGroups();

            upstreamGroups = upstreamGroups.filter(g => effectiveSources.includes(g.source));
            console.log(`   ✓ Filtered groups to ${upstreamGroups.length} from effective sources`);

            // Deduplicate groups by name (in case multiple sources have same group names)
            const groupMap = new Map<string, typeof upstreamGroups[0]>();
            for (const group of upstreamGroups) {
                if (!groupMap.has(group.name)) {
                    groupMap.set(group.name, group);
                }
            }
            const uniqueGroups = Array.from(groupMap.values());
            console.log(`   ✓ Deduplicated to ${uniqueGroups.length} unique groups`);

            groups = uniqueGroups;
        }

        config['proxy-groups'] = groups.map((g: any) => {
            // Expand dynamic proxies (SOURCE:xxx)
            const expandedProxies: string[] = [];

            if (g.proxies && Array.isArray(g.proxies)) {
                for (const proxyName of g.proxies) {
                    if (proxyName.startsWith('SOURCE:')) {
                        const sourceName = proxyName.substring(7);
                        // Find all proxies from this source
                        const sourceProxies = allProxies
                            .filter(p => p.source === sourceName)
                            .map(p => p.config.name);

                        if (sourceProxies.length > 0) {
                            expandedProxies.push(...sourceProxies);
                        }
                    } else if (proxyName.startsWith('KEYWORD:')) {
                        const keyword = proxyName.substring(8).toLowerCase();
                        const matchedProxies = allProxies
                            .filter(p => p.config.name.toLowerCase().includes(keyword))
                            .map(p => p.config.name);
                        expandedProxies.push(...matchedProxies);
                    } else if (proxyName.startsWith('REGEX:')) {
                        try {
                            const regex = new RegExp(proxyName.substring(6));
                            const matchedProxies = allProxies
                                .filter(p => regex.test(p.config.name))
                                .map(p => p.config.name);
                            expandedProxies.push(...matchedProxies);
                        } catch (e) {
                            console.warn(`Invalid regex in group ${g.name}: ${proxyName}`);
                        }
                    } else {
                        expandedProxies.push(proxyName);
                    }
                }
            }

            // Deduplicate proxies in the group
            const uniqueProxies = Array.from(new Set(expandedProxies));

            // Build group object with proper field order
            const group: any = {
                name: g.name,
                type: g.type,
                proxies: uniqueProxies.length > 0 ? uniqueProxies : ['REJECT'], // Fallback to REJECT if empty
            };

            // Add other config fields (url, interval, etc.) but avoid duplicating name/type/proxies
            if (g.config) {
                // Case 1: g is a ProxyGroup from DB (has .config)
                for (const [key, value] of Object.entries(g.config)) {
                    if (key !== 'name' && key !== 'type' && key !== 'proxies') {
                        group[key] = value;
                    }
                }
            } else {
                // Case 2: g is a raw object from YAML (custom group)
                for (const [key, value] of Object.entries(g)) {
                    if (key !== 'name' && key !== 'type' && key !== 'proxies' && key !== 'config') {
                        group[key] = value;
                    }
                }
            }

            return group;
        });

        // 4. Get Rules
        let rules: string[] = [];

        // Add subscription custom rules first (higher priority)
        if (sub.customRules) {
            const customRuleLines = sub.customRules
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            rules.push(...customRuleLines);
            console.log(`   ✓ Added ${customRuleLines.length} custom rules`);
        }

        // Then add rule set or upstream rules
        if (sub.ruleId && sub.ruleId !== 'default') {
            // Use custom rule set - get userId from subscription owner
            const user = await db.getUser(sub.username);
            if (user) {
                const customRule = await db.getCustomRule(sub.ruleId, user.id);
                if (customRule) {
                    const customRules = yaml.load(customRule.content);
                    if (Array.isArray(customRules)) {
                        rules.push(...customRules);
                    }
                }
            }
        } else {
            // Use upstream rules - filter by effective sources
            let upstreamRules = await db.getRules();

            upstreamRules = upstreamRules.filter(r => effectiveSources.includes(r.source));
            console.log(`   ✓ Filtered rules to ${upstreamRules.length} from effective sources`);

            rules.push(...upstreamRules.map(r => r.ruleText));
        }

        config.rules = rules;
        console.log(`   ✓ Total rules: ${rules.length}`);

        // Debug: Check for duplicates before YAML generation
        const groupNames = config['proxy-groups'].map((g: any) => g.name);
        const uniqueNames = new Set(groupNames);
        console.log(`   📊 Groups before YAML: ${groupNames.length} total, ${uniqueNames.size} unique`);
        if (groupNames.length !== uniqueNames.size) {
            console.warn(`   ⚠️ WARNING: Duplicate groups detected before YAML generation!`);
            console.warn(`   Duplicates:`, groupNames.filter((n: string, i: number) => groupNames.indexOf(n) !== i));
        }

        // 5. Generate YAML with proper options
        return yaml.dump(config, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        });
    } catch (error) {
        console.error('❌ Failed to build subscription YAML:', error);
        throw error;
    }
}
