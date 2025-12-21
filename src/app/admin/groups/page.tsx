import { getParsedConfig } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export default async function AdminGroupsPage() {
    const config = await getParsedConfig();

    if (!config) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-xl font-bold mb-2">未找到订阅配置</h2>
            </div>
        );
    }

    const groups = config['proxy-groups'] || [];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                🤖 策略组
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{groups.length}</span>
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {groups.map((group, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{group.name}</h3>
                                <div className="mt-1">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                        Type: {group.type}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">包含节点 ({group.proxies?.length})</label>
                            <div className="flex flex-wrap gap-2">
                                {group.proxies?.map((proxyName, pIdx) => (
                                    <span key={pIdx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                                        {proxyName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {groups.length === 0 && (
                    <div className="text-center py-8 text-gray-400 col-span-full bg-white rounded-xl border border-dashed">
                        暂无策略组数据
                    </div>
                )}
            </div>
        </div>
    );
}
