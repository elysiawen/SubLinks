'use client';

import { useState } from 'react';
import { addUpstreamSource, deleteUpstreamSource, updateUpstreamSource, forceRefreshUpstream, refreshSingleSource, setDefaultUpstreamSource } from './actions';

interface UpstreamSource {
    name: string;
    url: string;
    cacheDuration?: number;
    uaWhitelist?: string[];
    refreshSchedule?: {
        type: 'interval' | 'daily';
        value: number;
    };
    isDefault?: boolean;
}

export default function UpstreamSourcesClient({ sources: initialSources }: { sources: UpstreamSource[] }) {
    const [sources, setSources] = useState<UpstreamSource[]>(initialSources);
    const [isAdding, setIsAdding] = useState(false);
    const [editingSource, setEditingSource] = useState<UpstreamSource | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formUaWhitelist, setFormUaWhitelist] = useState('');
    const [formRefreshType, setFormRefreshType] = useState<'interval' | 'daily'>('interval');
    const [formRefreshInterval, setFormRefreshInterval] = useState(24); // hours
    const [formRefreshDaily, setFormRefreshDaily] = useState(3); // hour of day

    const resetForm = () => {
        setFormName('');
        setFormUrl('');
        setFormUaWhitelist('');
        setFormRefreshType('interval');
        setFormRefreshInterval(24);
        setFormRefreshDaily(3);
    };

    const validateForm = () => {
        if (!formName.trim()) {
            alert('请输入上游源名称');
            return false;
        }
        if (!formUrl.trim()) {
            alert('请输入订阅URL');
            return false;
        }
        if (!formUrl.startsWith('http://') && !formUrl.startsWith('https://')) {
            alert('订阅URL必须以 http:// 或 https:// 开头');
            return false;
        }
        if (formRefreshType === 'interval') {
            if (formRefreshInterval < 1 || formRefreshInterval > 168) {
                alert('刷新间隔必须在 1-168 小时之间 (最长一周)');
                return false;
            }
        } else if (formRefreshType === 'daily') {
            if (formRefreshDaily < 0 || formRefreshDaily > 23) {
                alert('刷新时间必须在 0-23 点之间');
                return false;
            }
        }
        return true;
    };

    const openEditModal = (source: UpstreamSource) => {
        setFormName(source.name);
        setFormUrl(source.url);
        setFormUaWhitelist((source.uaWhitelist || []).join(', '));
        setFormRefreshType(source.refreshSchedule?.type || 'interval');
        if (source.refreshSchedule?.type === 'daily') {
            setFormRefreshDaily(source.refreshSchedule.value);
        } else {
            setFormRefreshInterval(source.refreshSchedule?.value || 24);
        }
        setEditingSource(source);
        setIsAdding(false);
    };

    const handleAdd = async () => {
        if (!validateForm()) return;

        if (sources.some(s => s.name === formName.trim())) {
            alert('上游源名称已存在');
            return;
        }

        setLoading(true);
        const uaList = formUaWhitelist.split(',').map(s => s.trim()).filter(Boolean);
        await addUpstreamSource(formName.trim(), formUrl.trim(), 24, uaList);
        setLoading(false);
        resetForm();
        setIsAdding(false);
        window.location.reload();
    };

    const handleUpdate = async () => {
        if (!editingSource) return;
        if (!validateForm()) return;

        setLoading(true);
        const uaList = formUaWhitelist.split(',').map(s => s.trim()).filter(Boolean);
        const refreshSchedule = {
            type: formRefreshType,
            value: formRefreshType === 'interval' ? formRefreshInterval : formRefreshDaily
        };

        await updateUpstreamSource(
            editingSource.name,
            formName.trim(),
            formUrl.trim(),
            24, // Keep default cache duration
            uaList,
            refreshSchedule
        );

        setLoading(false);
        resetForm();
        setEditingSource(null);
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

    const handleForceRefresh = async () => {
        if (!confirm('确定要强制刷新所有上游源吗？\n\n这将重新获取所有上游订阅数据并清空所有订阅缓存。')) {
            return;
        }

        setLoading(true);
        const result = await forceRefreshUpstream();
        setLoading(false);

        if (result.success) {
            alert('✅ 上游源刷新成功！');
            window.location.reload();
        } else {
            alert('❌ 上游源刷新失败，请查看日志');
        }
    };

    const handleRefreshSingle = async (sourceName: string) => {
        if (!confirm(`确定要刷新上游源 "${sourceName}" 吗？\n\n这将重新获取该上游源的订阅数据。`)) {
            return;
        }

        setLoading(true);
        const result = await refreshSingleSource(sourceName);
        setLoading(false);

        if (result.success) {
            alert(`✅ 上游源 "${sourceName}" 刷新成功！`);
            window.location.reload();
        } else {
            alert(`❌ 上游源 "${sourceName}" 刷新失败，请查看日志`);
        }
    };

    const handleSetDefault = async (sourceName: string) => {
        setLoading(true);
        const result = await setDefaultUpstreamSource(sourceName);
        setLoading(false);

        if (result.success) {
            window.location.reload();
        } else {
            alert(`❌ 设置默认源失败: ${result.error}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    📡 上游订阅源管理
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{sources.length}</span>
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleForceRefresh}
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium text-sm"
                    >
                        🔄 强制刷新
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setEditingSource(null);
                            setIsAdding(!isAdding);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                        {isAdding ? '取消' : '+ 添加上游源'}
                    </button>
                </div>
            </div>

            {/* Add/Edit Form Modal */}
            {(isAdding || editingSource) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        {editingSource ? '编辑上游源' : '添加新的上游源'}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">上游源名称 *</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="例如：机场A、备用源"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">订阅URL *</label>
                            <input
                                type="url"
                                value={formUrl}
                                onChange={(e) => setFormUrl(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="https://..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">UA 白名单 (可选，逗号分隔)</label>
                            <input
                                type="text"
                                value={formUaWhitelist}
                                onChange={(e) => setFormUaWhitelist(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Clash, Shadowrocket"
                            />
                            <p className="text-xs text-gray-500 mt-1">留空表示不限制客户端类型</p>
                        </div>

                        {/* Refresh Schedule */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">上游刷新计划 *</label>
                            <p className="text-xs text-gray-500 mb-3">设置多久从上游源重新获取一次订阅数据</p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="interval"
                                            checked={formRefreshType === 'interval'}
                                            onChange={(e) => setFormRefreshType(e.target.value as 'interval')}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm text-gray-700">每隔</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formRefreshInterval}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) {
                                                setFormRefreshInterval(Math.max(1, Math.min(168, val)));
                                            } else {
                                                setFormRefreshInterval(val);
                                            }
                                        }}
                                        disabled={formRefreshType !== 'interval'}
                                        className="w-24 border border-gray-300 rounded px-3 py-1 text-sm disabled:bg-gray-100"
                                        min="1"
                                        max="168"
                                    />
                                    <span className="text-sm text-gray-700">小时刷新一次</span>
                                    <span className="text-xs text-gray-400">(1-168小时)</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="daily"
                                            checked={formRefreshType === 'daily'}
                                            onChange={(e) => setFormRefreshType(e.target.value as 'daily')}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm text-gray-700">每天</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formRefreshDaily}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) {
                                                setFormRefreshDaily(Math.max(0, Math.min(23, val)));
                                            } else {
                                                setFormRefreshDaily(val);
                                            }
                                        }}
                                        disabled={formRefreshType !== 'daily'}
                                        className="w-24 border border-gray-300 rounded px-3 py-1 text-sm disabled:bg-gray-100"
                                        min="0"
                                        max="23"
                                    />
                                    <span className="text-sm text-gray-700">点刷新</span>
                                    <span className="text-xs text-gray-400">(0-23点)</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={editingSource ? handleUpdate : handleAdd}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                            >
                                {loading ? (editingSource ? '更新中...' : '添加中...') : (editingSource ? '确认更新' : '确认添加')}
                            </button>
                            {editingSource && (
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setEditingSource(null);
                                    }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    取消
                                </button>
                            )}
                        </div>
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
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-semibold text-gray-800">{source.name}</h3>
                                        {source.isDefault && (
                                            <span className="bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded text-xs font-medium">
                                                ⭐ 默认
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 break-all mb-2">{source.url}</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        {source.uaWhitelist && source.uaWhitelist.length > 0 && (
                                            <span className="bg-green-50 text-green-600 px-2 py-1 rounded">
                                                🔒 UA限制
                                            </span>
                                        )}
                                        {source.refreshSchedule && (
                                            <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded">
                                                🔄 {source.refreshSchedule.type === 'interval'
                                                    ? `每${source.refreshSchedule.value}h`
                                                    : `每天${source.refreshSchedule.value}:00`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRefreshSingle(source.name)}
                                        disabled={loading}
                                        className="flex-1 bg-green-50 text-green-600 px-3 py-2 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors font-medium text-sm"
                                        title="刷新此上游源"
                                    >
                                        🔄
                                    </button>
                                    <button
                                        onClick={() => openEditModal(source)}
                                        disabled={loading}
                                        className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors font-medium text-sm"
                                    >
                                        编辑
                                    </button>
                                    <button
                                        onClick={() => handleDelete(source.name)}
                                        disabled={loading}
                                        className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors font-medium text-sm"
                                    >
                                        删除
                                    </button>
                                </div>
                                {!source.isDefault && (
                                    <button
                                        onClick={() => handleSetDefault(source.name)}
                                        disabled={loading}
                                        className="w-full bg-yellow-50 text-yellow-600 px-3 py-2 rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-colors font-medium text-sm"
                                    >
                                        ⭐ 设为默认
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div >
            )}
        </div >
    );
}
