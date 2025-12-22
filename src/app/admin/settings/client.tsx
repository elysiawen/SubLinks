'use client';

import React, { useState } from 'react';

function RetentionSelector({ initialValue }: { initialValue: number }) {
    const isPreset = [30, 180, 365, 0].includes(initialValue);
    const [mode, setMode] = useState<string>(isPreset ? initialValue.toString() : 'custom');

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">保留时间</label>
            <div className="space-y-3">
                <select
                    name="retentionSelect"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white text-gray-900"
                >
                    <option value="30">30天 (推荐)</option>
                    <option value="180">半年 (180天)</option>
                    <option value="365">一年 (365天)</option>
                    <option value="0">永久保存 (不清理)</option>
                    <option value="custom">自定义天数...</option>
                </select>

                {mode === 'custom' && (
                    <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <input
                            type="number"
                            name="customDays"
                            defaultValue={isPreset ? 30 : initialValue}
                            min="1"
                            className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            placeholder="天数"
                        />
                        <span className="text-gray-500 text-sm">天</span>
                    </div>
                )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
                系统将自动清理早于指定天数的日志记录。设置的时间越短，数据库体积越小。
            </p>
        </div>
    );
}


export default function AdminSettingsClient({ config }: { config: any }) {
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">全局设置</h2>

            {/* Log Retention Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🗑️</span> 日志自动清理
                </h3>
                <form action={async (formData) => {
                    formData.append('cacheDuration', config.cacheDuration?.toString() || '24');
                    formData.append('uaWhitelist', (config.uaWhitelist || []).join(','));
                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));

                    // Handle custom retention
                    const retentionSelect = formData.get('retentionSelect') as string;
                    let days = retentionSelect;
                    if (retentionSelect === 'custom') {
                        days = formData.get('customDays') as string;
                    }
                    formData.set('logRetentionDays', days);

                    const { updateGlobalConfig } = await import('../actions');
                    await updateGlobalConfig(formData);
                }} className="space-y-4">

                    <RetentionSelector initialValue={config.logRetentionDays || 30} />

                    <div className="pt-2 flex gap-4">
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            保存设置
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirm('⚠️ 确定要立即删除系统中的所有日志吗？此操作无法撤销。')) {
                                    const { clearLogs } = await import('../actions');
                                    const res = await clearLogs(0);
                                    if (res?.success) {
                                        alert('所有日志已清理完成');
                                    } else {
                                        alert('清理失败');
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition"
                        >
                            立即清理
                        </button>
                    </div>
                </form>
            </div>


            {/* User Limits */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">👤</span> 用户限制
                </h3>
                <form action={async (formData) => {
                    formData.append('cacheDuration', config.cacheDuration?.toString() || '24');
                    formData.append('uaWhitelist', (config.uaWhitelist || []).join(','));
                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');

                    // Handle max subs
                    const maxSubs = formData.get('maxUserSubscriptions') as string;
                    formData.set('maxUserSubscriptions', maxSubs);

                    const { updateGlobalConfig } = await import('../actions');
                    await updateGlobalConfig(formData);
                }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">每个用户最大订阅数</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="number"
                                name="maxUserSubscriptions"
                                defaultValue={config.maxUserSubscriptions ?? 0}
                                min="0"
                                className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                            <span className="text-gray-500 text-sm">条 (0 表示不限制)</span>
                        </div>
                    </div>
                    <div className="pt-2">
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            保存设置
                        </button>
                    </div>
                </form>
            </div>

            {/* Other settings placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 opacity-60">
                <h3 className="text-lg font-bold text-gray-800 mb-4">其他设置</h3>
                <p className="text-gray-500">上游源和缓存设置请前往 <a href="/admin/sources" className="text-blue-600 hover:underline">上游源管理</a> 页面配置。</p>
            </div>
        </div>
    );
}
