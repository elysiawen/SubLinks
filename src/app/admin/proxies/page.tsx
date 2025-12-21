import { getParsedConfig } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export default async function AdminProxiesPage() {
    const config = await getParsedConfig();

    if (!config) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-xl font-bold mb-2">未找到订阅配置</h2>
                <p>请先在全局设置中配置上游链接，并等待至少一次请求以触发缓存。</p>
            </div>
        );
    }

    const { proxies } = config;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                🌍 节点列表
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{proxies.length}</span>
            </h2>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">名称</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">服务器</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">端口</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">详细信息</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {proxies.map((proxy, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{proxy.name}</td>
                                    <td className="px-6 py-3 text-sm text-gray-500">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                            {proxy.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-500 font-mono">{proxy.server}</td>
                                    <td className="px-6 py-3 text-sm text-gray-500 font-mono">{proxy.port}</td>
                                    <td className="px-6 py-3 text-xs text-gray-400 font-mono max-w-xs truncate" title={JSON.stringify(proxy)}>
                                        {proxy.uuid || proxy.password ? 'Has Auth' : '-'}
                                        {proxy.network ? ` | ${proxy.network}` : ''}
                                    </td>
                                </tr>
                            ))}
                            {proxies.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        暂无节点数据
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
