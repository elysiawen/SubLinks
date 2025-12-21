import { getParsedConfig } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export default async function AdminRulesPage() {
    const config = await getParsedConfig();

    if (!config) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-xl font-bold mb-2">未找到订阅配置</h2>
            </div>
        );
    }

    const rules = config.rules || [];

    // Simple parsing to split Type, Value, and Target
    const parsedRules = rules.map((ruleStr: string) => {
        const parts = ruleStr.split(',');
        return {
            raw: ruleStr,
            type: parts[0]?.trim(),
            value: parts[1]?.trim(),
            target: parts[2]?.trim(),
            noResolve: parts.includes('no-resolve')
        };
    });

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                📝 分流规则
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{rules.length}</span>
            </h2>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 table-fixed">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">类型</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">匹配值</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">策略/节点</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">属性</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {parsedRules.map((rule, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-2 text-sm font-medium text-blue-600 truncate">{rule.type}</td>
                                    <td className="px-6 py-2 text-sm text-gray-700 font-mono truncate" title={rule.value}>{rule.value}</td>
                                    <td className="px-6 py-2 text-sm">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                            ${rule.target === 'REJECT' ? 'bg-red-50 text-red-700 border border-red-100' :
                                                rule.target === 'DIRECT' ? 'bg-green-50 text-green-700 border border-green-100' :
                                                    'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                                            {rule.target}
                                        </span>
                                    </td>
                                    <td className="px-6 py-2 text-xs text-gray-400">
                                        {rule.noResolve && 'no-resolve'}
                                    </td>
                                </tr>
                            ))}
                            {rules.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                        暂无规则数据
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
