'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/Modal';
import { Search } from 'lucide-react';

export default function AdminGroupsClient({ groupsBySource, totalCount, customSets }: {
    groupsBySource: Record<string, any[]>,
    totalCount: number,
    customSets: any[]
}) {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const sources = Object.keys(groupsBySource).sort();
    const selectedGroups = selectedSource ? groupsBySource[selectedSource] : [];

    // Filter groups based on search query
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return selectedGroups;
        const query = searchQuery.toLowerCase();
        return selectedGroups.filter(group => {
            // Search in group name, type, and proxies
            const nameMatch = group.name?.toLowerCase().includes(query);
            const typeMatch = group.type?.toLowerCase().includes(query);
            const proxiesMatch = group.proxies?.some((proxy: string) => proxy.toLowerCase().includes(query));
            return nameMatch || typeMatch || proxiesMatch;
        });
    }, [selectedGroups, searchQuery]);

    // Reset search when modal closes
    const handleCloseModal = () => {
        setSelectedSource(null);
        setSearchQuery('');
    };

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
                onClose={handleCloseModal}
                title={
                    selectedSource ? (
                        <div className="flex items-center gap-2">
                            <span>📡 {selectedSource}</span>
                            <span className="text-sm font-normal text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                                {filteredGroups.length} / {selectedGroups.length} 个策略组
                            </span>
                        </div>
                    ) : ''
                }
                maxWidth="max-w-4xl"
            >
                {selectedSource && (
                    <div className="space-y-4">
                        {/* Search Box */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索策略组名称、类型或代理..."
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-gray-500 focus:border-gray-500 block w-full pl-10 p-2.5 shadow-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Groups List */}
                        <div className="overflow-auto max-h-[60vh] space-y-4">
                            {filteredGroups.length > 0 ? (
                                filteredGroups.map((group, idx) => (
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
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    {searchQuery ? '没有找到匹配的策略组' : '暂无策略组'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
