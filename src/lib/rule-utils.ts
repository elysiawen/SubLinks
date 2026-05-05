export interface RuleItem {
    type: string;
    value: string;
    policy: string;
    id: string;
}

/**
 * Generate a random temporary ID for GUI rule items.
 */
export function genId(): string {
    return Math.random().toString(36).substring(2, 11);
}

/**
 * Parse CSV rule text into structured rule items.
 * Handles both `TYPE,VALUE,POLICY` and `- TYPE,VALUE,POLICY` formats.
 * Filters out comments (#) and empty lines.
 */
export function parseRules(text: string): RuleItem[] {
    if (!text) return [];
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const parts = line.replace(/^-\s*/, '').split(',').map(p => p.trim());
            if (parts.length >= 3) {
                return { type: parts[0], value: parts[1], policy: parts[2], id: genId() };
            }
            return null;
        })
        .filter((r): r is RuleItem => r !== null);
}

/**
 * Serialize rule items to CSV text (without `- ` prefix).
 */
export function stringifyRules(rules: { type: string; value: string; policy: string }[]): string {
    return rules.map(r => `${r.type},${r.value},${r.policy}`).join('\n');
}
