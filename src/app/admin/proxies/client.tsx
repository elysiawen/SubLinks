'use client';

import { useState } from 'react';

export default function AdminProxiesClient({ proxiesBySource, totalCount }: { proxiesBySource: Record<string, any[]>, totalCount: number }) {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);

    const sources = Object.keys(proxiesBySource).sort();
    const selectedProxies = selectedSource ? proxiesBySource[selectedSource] : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🌍 节点列表
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{totalCount}</span>
                </h2>
            </div>

            {sources.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无节点数据
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map(source => {
                    const proxies = proxiesBySource[source];

                    return (
                        <div key={source} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    📡 {source}
                                </h3>
                            </div>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">节点数量</span>
                                    <span className="font-semibold text-blue-600">{proxies.length}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSource(source)}
                                className="w-full bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                            >
                                查看详情
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {selectedSource && (
                <div
                    className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedSource(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                📡 {selectedSource}
                                <span className="text-sm font-normal text-gray-500 bg-white px-2 py-1 rounded-full">
                                    {selectedProxies.length} 个节点
                                </span>
                            </h3>
                            <button
                                onClick={() => setSelectedSource(null)}
                                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>
                        <div className="overflow-auto max-h-[calc(90vh-80px)]">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">名称</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">服务器</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">端口</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">详细信息</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {selectedProxies.map((proxy, idx) => (
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
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
