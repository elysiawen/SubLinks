'use client';

import { useState } from 'react';
import { updateGlobalConfig, clearCache } from '../actions';

export default function AdminSettingsClient({ config }: { config: any }) {
    const [loading, setLoading] = useState(false);

    const handleUpdateConfig = async (formData: FormData) => {
        setLoading(true);
        await updateGlobalConfig(formData);
        setLoading(false);
        alert('全局设置已保存');
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">全局设置</h2>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <form action={handleUpdateConfig} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">上游订阅链接 (Upstream URL)</label>
                        <input
                            name="upstreamUrl"
                            defaultValue={config.upstreamUrl}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            placeholder="https://airport.com/api/v1/client/subscribe?token=..."
                            required
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            这是您的原始机场订阅链接。系统会从此链接获取节点信息。
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">缓存时间 (小时)</label>
                            <input
                                name="cacheDuration"
                                type="number"
                                defaultValue={config.cacheDuration || 24}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">UA 白名单 (逗号分隔)</label>
                            <input
                                name="uaWhitelist"
                                defaultValue={config.uaWhitelist?.join(', ')}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                placeholder="Clash, Shadowrocket, Surge"
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                留空则允许所有客户端 (仅阻断微信/QQ等内置浏览器)。
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirm('确定要清理缓存吗？用户下次请求将回源。')) {
                                    await clearCache();
                                    alert('缓存已清理');
                                }
                            }}
                            className="text-red-600 hover:text-red-700 text-sm font-medium hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                        >
                            🗑️ 清理订阅缓存
                        </button>

                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm font-medium"
                        >
                            {loading ? '保存中...' : '保存设置'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
