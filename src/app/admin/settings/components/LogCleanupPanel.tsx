'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';

export default function LogCleanupPanel({ initialDays }: { initialDays: number }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [isCleaning, setIsCleaning] = useState(false);

    // Retention Days State
    const isPreset = [30, 180, 365, 0].includes(initialDays);
    const [mode, setMode] = useState<string>(isPreset ? initialDays.toString() : 'custom');
    const [customDays, setCustomDays] = useState(isPreset ? 30 : initialDays);

    // Log Types State
    const [logTypes, setLogTypes] = useState({
        api: true,
        web: true,
        system: true
    });

    const getDays = () => {
        if (mode === 'custom') return customDays;
        return parseInt(mode);
    };

    const handleCleanup = async () => {
        const days = getDays();
        const types = Object.entries(logTypes).filter(([_, checked]) => checked).map(([key]) => key);

        if (types.length === 0) {
            error('请至少选择一种日志类型');
            return;
        }

        if (days < 0) {
            error('请输入有效的天数');
            return;
        }

        if (await confirm(`⚠️ 确定要立即清理选中的日志吗？此操作无法撤销。\n\n保留天数: ${days === 0 ? '不清理 (0天)' : `${days}天`}\n清理类型: ${types.join(', ')}`, { confirmColor: 'red', confirmText: '立即清理' })) {
            setIsCleaning(true);
            try {
                const { clearLogs } = await import('../actions');
                const res = await clearLogs(days, types);
                if (res?.success) {
                    success('日志清理完成');
                } else {
                    error('清理失败');
                }
            } finally {
                setIsCleaning(false);
            }
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🗑️</span> 日志清理
            </h3>

            <div className="space-y-6">
                {/* Retention Days Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">保留时间</label>
                    <div className="flex items-center gap-4">
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                            className="block w-48 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white text-gray-900"
                        >
                            <option value="30">30天 (推荐)</option>
                            <option value="180">半年 (180天)</option>
                            <option value="365">一年 (365天)</option>
                            <option value="0">全部清理</option>
                            <option value="custom">自定义天数...</option>
                        </select>

                        {mode === 'custom' && (
                            <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                <input
                                    type="number"
                                    value={customDays}
                                    onChange={(e) => setCustomDays(parseInt(e.target.value) || 0)}
                                    min="0"
                                    className="block w-24 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                    placeholder="天数"
                                />
                                <span className="text-gray-500 text-sm">天</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Log Types Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">清理范围 (选择后立即生效)</label>
                    <div className="flex items-center flex-wrap gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <label className="inline-flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
                            <input
                                type="checkbox"
                                checked={logTypes.api}
                                onChange={(e) => setLogTypes(prev => ({ ...prev, api: e.target.checked }))}
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-gray-700">API日志</span>
                        </label>

                        <label className="inline-flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
                            <input
                                type="checkbox"
                                checked={logTypes.web}
                                onChange={(e) => setLogTypes(prev => ({ ...prev, web: e.target.checked }))}
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-gray-700">Web日志</span>
                        </label>

                        <label className="inline-flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
                            <input
                                type="checkbox"
                                checked={logTypes.system}
                                onChange={(e) => setLogTypes(prev => ({ ...prev, system: e.target.checked }))}
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-gray-700">系统日志</span>
                        </label>

                        <div className="flex-1"></div>

                        <button
                            type="button"
                            onClick={handleCleanup}
                            disabled={isCleaning}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium"
                        >
                            {isCleaning ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    清理中...
                                </>
                            ) : (
                                <>
                                    <span className="mr-2">🧹</span>
                                    {getDays() === 0 ? '清空全部' : '执行清理'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <p className="text-sm text-gray-500">
                    💡 选择"0"或"全部清理"将删除所选类型的所有历史记录。否则将保留最近 {getDays()} 天的日志。
                </p>
            </div>
        </div>
    );
}
