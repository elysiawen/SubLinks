'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

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
            <Modal
                isOpen={!!selectedSource}
                onClose={() => setSelectedSource(null)}
                title={
                    selectedSource ? (
                        <div className="flex items-center gap-2">
                            <span>📡 {selectedSource}</span>
                            <span className="text-sm font-normal text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                                {(selectedSource ? proxiesBySource[selectedSource] : []).length} 个节点
                            </span>
                        </div>
                    ) : ''
                }
                maxWidth="max-w-6xl"
            >
                {selectedSource && (
                    <div className="overflow-auto max-h-[70vh]">
                        {/* Desktop Table View */}
                        <table className="min-w-full divide-y divide-gray-100 hidden md:table">
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

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3 p-4 bg-gray-50">
                            {selectedProxies.map((proxy, idx) => (
                                <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="font-medium text-gray-900 break-all pr-2">{proxy.name}</div>
                                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                            {proxy.type}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                        <div className="bg-gray-50 p-2 rounded">
                                            <div className="text-gray-400 mb-1">Server</div>
                                            <div className="font-mono break-all">{proxy.server}</div>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded">
                                            <div className="text-gray-400 mb-1">Port</div>
                                            <div className="font-mono">{proxy.port}</div>
                                        </div>
                                    </div>
                                    {(proxy.network || proxy.uuid || proxy.password) && (
                                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 flex gap-2">
                                            {proxy.network && <span>Network: {proxy.network}</span>}
                                            {(proxy.uuid || proxy.password) && <span>AUTH</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
