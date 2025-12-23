'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

export default function AdminRulesClient({ rulesBySource, totalCount, customSets }: {
    rulesBySource: Record<string, string[]>,
    totalCount: number,
    customSets: any[]
}) {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);

    const sources = Object.keys(rulesBySource).sort();
    const selectedRules = selectedSource ? rulesBySource[selectedSource] : [];

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
                                </h3>
                            </div>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">规则数量</span>
                                    <span className="font-semibold text-orange-600">{rules.length}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSource(source)}
                                className="w-full bg-orange-50 text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-100 transition-colors font-medium text-sm"
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
                                {(selectedSource ? rulesBySource[selectedSource] : []).length} 条规则
                            </span>
                        </div>
                    ) : ''
                }
                maxWidth="max-w-4xl"
            >
                {selectedSource && (
                    <div className="overflow-auto max-h-[70vh]">
                        <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1">
                            {selectedRules.map((rule, idx) => (
                                <div key={idx} className="text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                                    <span className="text-gray-400 mr-2">{idx + 1}.</span>
                                    {rule}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
