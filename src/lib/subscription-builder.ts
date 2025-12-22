import { db } from './db';
import yaml from 'js-yaml';
import type { SubData } from './database/interface';

/**
 * Build subscription YAML from database structured data
 */
export async function buildSubscriptionYaml(sub: SubData & { token: string }): Promise<string> {
    try {
        console.log('📋 Building subscription for:', sub.remark || sub.token);
        console.log('   Custom rules:', sub.customRules ? `${sub.customRules.split('\n').length} lines` : 'none');
        console.log('   Selected sources:', sub.selectedSources || 'all');

        const config: any = {};

        // 1. Get Other Upstream Config FIRST (dns, tun, etc.) - put at top
        const upstreamConfig = await db.getAllUpstreamConfig();
        Object.assign(config, upstreamConfig);

        // 2. Get Proxies - filter by selected sources if specified
        let allProxies = await db.getProxies();

        // Filter by selected sources
        if (sub.selectedSources && sub.selectedSources.length > 0) {
            allProxies = allProxies.filter(p => sub.selectedSources!.includes(p.source));
            console.log(`   ✓ Filtered proxies to ${allProxies.length} from sources: ${sub.selectedSources.join(', ')}`);
        }

        config.proxies = allProxies.map(p => p.config);

        // 3. Get Proxy Groups
        let groups;
        if (sub.groupId && sub.groupId !== 'default') {
            // Use custom group set
            const customGroup = await db.getCustomGroup(sub.groupId);
            if (customGroup) {
                const customGroups = yaml.load(customGroup.content);
                if (Array.isArray(customGroups)) {
                    groups = customGroups;
                }
            }
        }

        if (!groups) {
            // Use upstream groups - filter by selected sources
            let upstreamGroups = await db.getProxyGroups();

            if (sub.selectedSources && sub.selectedSources.length > 0) {
                upstreamGroups = upstreamGroups.filter(g => sub.selectedSources!.includes(g.source));
                console.log(`   ✓ Filtered groups to ${upstreamGroups.length} from selected sources`);
            }

            groups = upstreamGroups.map(g => ({
                name: g.name,
                type: g.type,
                proxies: g.proxies,
                ...g.config,
            }));
        }

        config['proxy-groups'] = groups;

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
            // Use custom rule set
            const customRule = await db.getCustomRule(sub.ruleId);
            if (customRule) {
                const customRules = yaml.load(customRule.content);
                if (Array.isArray(customRules)) {
                    rules.push(...customRules);
                }
            }
        } else {
            // Use upstream rules - filter by selected sources
            let upstreamRules = await db.getRules();

            if (sub.selectedSources && sub.selectedSources.length > 0) {
                upstreamRules = upstreamRules.filter(r => sub.selectedSources!.includes(r.source));
                console.log(`   ✓ Filtered rules to ${upstreamRules.length} from selected sources`);
            }

            rules.push(...upstreamRules.map(r => r.ruleText));
        }

        config.rules = rules;
        console.log(`   ✓ Total rules: ${rules.length}`);

        // 5. Generate YAML
        return yaml.dump(config);
    } catch (error) {
        console.error('❌ Failed to build subscription YAML:', error);
        throw error;
    }
}
