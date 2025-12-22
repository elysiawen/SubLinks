'use client';

import { useState } from 'react';
import { addUpstreamSource, deleteUpstreamSource } from './actions';

interface UpstreamSource {
    name: string;
    url: string;
    cacheDuration?: number;
    uaWhitelist?: string[];
}

export default function UpstreamSourcesClient({ sources: initialSources }: { sources: UpstreamSource[] }) {
    const [sources, setSources] = useState<UpstreamSource[]>(initialSources);
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newCacheDuration, setNewCacheDuration] = useState(24);
    const [newUaWhitelist, setNewUaWhitelist] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAdd = async () => {
        if (!newName.trim() || !newUrl.trim()) {
            alert('请填写完整的名称和URL');
            return;
        }

        // Check for duplicate names
        if (sources.some(s => s.name === newName.trim())) {
            alert('上游源名称已存在');
            return;
        }

        setLoading(true);
        const uaList = newUaWhitelist.split(',').map(s => s.trim()).filter(Boolean);
        await addUpstreamSource(newName.trim(), newUrl.trim(), newCacheDuration, uaList);
        setLoading(false);
        setNewName('');
        setNewUrl('');
        setNewCacheDuration(24);
        setNewUaWhitelist('');
        setIsAdding(false);
        window.location.reload();
    };

    const handleDelete = async (sourceName: string) => {
        if (!confirm(`确定要删除上游源 "${sourceName}" 吗？\n\n这将同时删除该上游源的所有节点、策略组和规则数据。`)) {
            return;
        }

        setLoading(true);
        await deleteUpstreamSource(sourceName);
        setLoading(false);
        window.location.reload();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    📡 上游订阅源管理
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{sources.length}</span>
                </h2>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                    {isAdding ? '取消' : '+ 添加上游源'}
                </button>
            </div>

            {isAdding && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">添加新的上游源</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">上游源名称</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="例如：机场A、备用源"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">订阅URL</label>
                            <input
                                type="url"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="https://..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">缓存时间 (小时)</label>
                                <input
                                    type="number"
                                    value={newCacheDuration}
                                    onChange={(e) => setNewCacheDuration(parseInt(e.target.value) || 24)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="24"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">UA 白名单 (逗号分隔)</label>
                                <input
                                    type="text"
                                    value={newUaWhitelist}
                                    onChange={(e) => setNewUaWhitelist(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="Clash, Shadowrocket"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleAdd}
                            disabled={loading}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                        >
                            {loading ? '添加中...' : '确认添加'}
                        </button>
                    </div>
                </div>
            )}

            {sources.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无上游源,点击上方按钮添加
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sources.map((source, index) => (
                        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-1">{source.name}</h3>
                                    <p className="text-xs text-gray-400 break-all mb-2">{source.url}</p>
                                    <div className="flex gap-2 text-xs">
                                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">
                                            ⏱️ {source.cacheDuration || 24}h
                                        </span>
                                        {source.uaWhitelist && source.uaWhitelist.length > 0 && (
                                            <span className="bg-green-50 text-green-600 px-2 py-1 rounded">
                                                🔒 UA限制
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(source.name)}
                                disabled={loading}
                                className="w-full mt-4 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors font-medium text-sm"
                            >
                                删除
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
