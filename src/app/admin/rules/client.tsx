'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/Modal';
import { Search } from 'lucide-react';
import StaticSourceEditor from '../sources/StaticSourceEditor';

export default function AdminRulesClient({
    rulesBySource,
    totalCount,
    customSets,
    sourceTypes = {}
}: {
    rulesBySource: Record<string, string[]>,
    totalCount: number,
    customSets: any[],
    sourceTypes?: Record<string, string>
}) {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSource, setEditingSource] = useState<string | null>(null);

    const sources = Object.keys(rulesBySource).sort();
    const selectedRules = selectedSource ? rulesBySource[selectedSource] : [];

    // Filter rules based on search query
    const filteredRules = useMemo(() => {
        if (!searchQuery.trim()) return selectedRules;
        const query = searchQuery.toLowerCase();
        return selectedRules.filter(rule => rule.toLowerCase().includes(query));
    }, [selectedRules, searchQuery]);

    // Reset search when modal closes
    const handleCloseModal = () => {
        setSelectedSource(null);
        setSearchQuery('');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    ⚡ 分流规则列表
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{totalCount}</span>
                </h2>
                <a
                    href="/admin/rules/custom"
                    className="text-sm bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                    📝 管理自定义规则集
                </a>
            </div>

            {customSets.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">📚 自定义规则集</h3>
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
                    暂无规则数据
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map(source => {
                    const rules = rulesBySource[source];

                    return (
                        <div key={source} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    📡 {source}
                                    {sourceTypes[source] === 'static' && (
                                        <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                            静态
                                        </span>
                                    )}
                                </h3>
                            </div>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">规则数量</span>
                                    <span className="font-semibold text-orange-600">{rules.length}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedSource(source)}
                                    className={`bg-orange-50 text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-100 transition-colors font-medium text-sm ${sourceTypes[source] === 'static' ? 'flex-1' : 'w-full'}`}
                                >
                                    查看详情
                                </button>
                                {sourceTypes[source] === 'static' && (
                                    <button
                                        onClick={() => setEditingSource(source)}
                                        className="bg-purple-50 text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-100 transition-colors font-medium text-sm flex-1"
                                    >
                                        ⚙️ 管理
                                    </button>
                                )}
                            </div>
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
                                {filteredRules.length} / {selectedRules.length} 条规则
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
                                placeholder="搜索规则..."
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

                        {/* Rules List */}
                        <div className="overflow-auto max-h-[60vh]">
                            {filteredRules.length > 0 ? (
                                <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1">
                                    {filteredRules.map((rule, idx) => (
                                        <div key={idx} className="text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                                            <span className="text-gray-400 mr-2">{selectedRules.indexOf(rule) + 1}.</span>
                                            {rule}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    {searchQuery ? '没有找到匹配的规则' : '暂无规则'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {editingSource && (
                <StaticSourceEditor
                    sourceName={editingSource}
                    open={!!editingSource}
                    onClose={() => setEditingSource(null)}
                    onUpdate={() => {
                        // Trigger refresh if needed
                    }}
                    defaultTab="rules"
                />
            )}
        </div>
    );
}
