import { db } from '@/lib/db';
import { getRuleSets } from '@/lib/config-actions';
import AdminRulesClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminRulesPage() {
    let rulesBySource: Record<string, string[]> = {};
    let totalCount = 0;
    let error: string | null = null;

    try {
        const allRules = await db.getRules();
        totalCount = allRules.length;

        // Group by source
        for (const rule of allRules) {
            const source = rule.source || 'unknown';
            if (!rulesBySource[source]) {
                rulesBySource[source] = [];
            }
            rulesBySource[source].push(rule.ruleText);
        }
    } catch (e: any) {
        error = e.message;
        console.error('Failed to get rules:', e);
    }

    const customSets = await getRuleSets();

    if (error) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">⚡ 分流规则列表</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">⚠️ 加载失败: {error}</p>
                </div>
            </div>
        );
    }

    const sourcesList = await db.getUpstreamSources();
    const sourceTypes: Record<string, string> = {};
    sourcesList.forEach(s => {
        sourceTypes[s.name] = s.type || 'url';
    });

    return <AdminRulesClient rulesBySource={rulesBySource} totalCount={totalCount} customSets={customSets} sourceTypes={sourceTypes} />;
}
