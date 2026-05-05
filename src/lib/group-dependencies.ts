import yaml from 'js-yaml';

/**
 * Resolve which upstream sources a custom group depends on.
 *
 * Parses the group's YAML content and extracts source references from:
 * - `SOURCE:xxx` — direct source reference
 * - `KEYWORD:xxx` / `REGEX:xxx` — dynamic filters (all enabled sources are considered dependencies)
 * - Literal node names — resolved via `proxySourceMap` or `availableProxies`
 *
 * @param content - YAML content of the custom group
 * @param options.proxySourceMap - Map of proxy name → source name (preferred)
 * @param options.availableProxies - Fallback: array of proxies with name and source
 * @param options.availableSources - Used when dynamic filters are detected (KEYWORD/REGEX)
 * @returns Array of unique source names that this group depends on
 */
export function getGroupDependencies(
    content: string,
    options: {
        proxySourceMap?: Record<string, string>;
        availableProxies?: { name: string; source: string }[];
        availableSources?: { name: string; enabled?: boolean }[];
    } = {}
): string[] {
    const { proxySourceMap = {}, availableProxies = [], availableSources = [] } = options;

    try {
        const parsed = yaml.load(content) as any;
        const groups = Array.isArray(parsed) ? parsed : [parsed];
        const sources = new Set<string>();
        let hasDynamicFilter = false;

        groups.forEach((g: any) => {
            if (Array.isArray(g.proxies)) {
                g.proxies.forEach((p: string) => {
                    if (typeof p !== 'string') return;

                    if (p.startsWith('SOURCE:')) {
                        sources.add(p.substring(7));
                    } else if (p.startsWith('KEYWORD:') || p.startsWith('REGEX:')) {
                        hasDynamicFilter = true;
                    } else {
                        // Literal node name — resolve to source
                        if (proxySourceMap[p]) {
                            sources.add(proxySourceMap[p]);
                        } else {
                            const proxy = availableProxies.find(ap => ap.name === p);
                            if (proxy) {
                                sources.add(proxy.source);
                            }
                        }
                    }
                });
            }
        });

        // Dynamic filters match against all enabled sources
        if (hasDynamicFilter) {
            availableSources
                .filter(s => s.enabled !== false)
                .forEach(s => sources.add(s.name));
        }

        return Array.from(sources).filter(Boolean);
    } catch (e) {
        return [];
    }
}
