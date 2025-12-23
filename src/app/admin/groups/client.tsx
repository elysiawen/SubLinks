'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

export default function AdminGroupsClient({ groupsBySource, totalCount, customSets }: {
    groupsBySource: Record<string, any[]>,
    totalCount: number,
    customSets: any[]
}) {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);

    const sources = Object.keys(groupsBySource).sort();
    const selectedGroups = selectedSource ? groupsBySource[selectedSource] : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🎯 策略组列表
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{totalCount}</span>
                </h2>
                <a
                    href="/admin/groups/custom"
                    className="text-sm bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                    📝 管理自定义策略组
                </a>
            </div>

            {customSets.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">📚 自定义策略组集</h3>
                    <div className="flex flex-wrap gap-2">
                        {customSets.map(set => (
                            <span key={set.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-purple-700 border border-purple-200">
                                {set.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {sources.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无策略组数据
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map(source => {
                    const groups = groupsBySource[source];

                    return (
                        <div key={source} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    📡 {source}
                                </h3>
                            </div>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">策略组数量</span>
                                    <span className="font-semibold text-green-600">{groups.length}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSource(source)}
                                className="w-full bg-green-50 text-green-600 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors font-medium text-sm"
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
                                {(selectedSource ? groupsBySource[selectedSource] : []).length} 个策略组
                            </span>
                        </div>
                    ) : ''
                }
                maxWidth="max-w-4xl"
            >
                {selectedSource && (
                    <div className="overflow-auto max-h-[70vh] space-y-4">
                        {selectedGroups.map((group, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-base font-semibold text-gray-800">{group.name}</h4>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                        {group.type}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">代理列表:</span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {group.proxies && group.proxies.length > 0 ? (
                                            group.proxies.map((proxy: string, i: number) => (
                                                <span key={i} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                                    {proxy}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-400 text-xs">无代理</span>
                                        )}
                                    </div>
                                </div>
                                {group.url && (
                                    <div className="mt-2 text-xs text-gray-500">
                                        <span className="font-medium">URL:</span> {group.url}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
}
