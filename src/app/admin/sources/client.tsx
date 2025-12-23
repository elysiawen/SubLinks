'use client';

import { useState } from 'react';
import { addUpstreamSource, deleteUpstreamSource, updateUpstreamSource, forceRefreshUpstream, refreshSingleSource, setDefaultUpstreamSource } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface UpstreamSource {
    name: string;
    url: string;
    cacheDuration?: number;
    uaWhitelist?: string[];
    isDefault?: boolean;
    lastUpdated?: number;
    status?: 'pending' | 'success' | 'failure';
    error?: string;
}

export default function UpstreamSourcesClient({ sources: initialSources }: { sources: UpstreamSource[] }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [sources, setSources] = useState<UpstreamSource[]>(initialSources);
    const [isAdding, setIsAdding] = useState(false);
    const [editingSource, setEditingSource] = useState<UpstreamSource | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formCacheDuration, setFormCacheDuration] = useState<string>('24');
    const [formDurationUnit, setFormDurationUnit] = useState<'hours' | 'minutes'>('hours');
    const [formUaWhitelist, setFormUaWhitelist] = useState('');

    const resetForm = () => {
        setFormName('');
        setFormUrl('');
        setFormCacheDuration('24');
        setFormDurationUnit('hours');
        setFormUaWhitelist('');
    };

    const validateForm = () => {
        if (!formName.trim()) {
            error('请输入上游源名称');
            return false;
        }
        if (!formUrl.trim()) {
            error('请输入订阅URL');
            return false;
        }
        if (!formUrl.startsWith('http://') && !formUrl.startsWith('https://')) {
            error('订阅URL必须以 http:// 或 https:// 开头');
            return false;
        }
        // Duplicate check removed, redundant with next check
        return true;
    };

    const openEditModal = (source: UpstreamSource) => {
        setFormName(source.name);
        setFormUrl(source.url);

        // Smart unit detection
        const duration = source.cacheDuration;
        if (duration === 0) {
            setFormCacheDuration('0');
            setFormDurationUnit('hours');
        } else {
            const effectiveDuration = duration || 24;
            if (effectiveDuration < 1 && effectiveDuration > 0) {
                setFormCacheDuration(String(Math.round(effectiveDuration * 60)));
                setFormDurationUnit('minutes');
            } else {
                setFormCacheDuration(String(effectiveDuration));
                setFormDurationUnit('hours');
            }
        }

        setFormUaWhitelist((source.uaWhitelist || []).join(', '));
        setEditingSource(source);
        setIsAdding(false);
    };

    const handleAdd = async () => {
        if (!validateForm()) return;

        if (sources.some(s => s.name === formName.trim())) {
            error('上游源名称已存在');
            return;
        }

        setLoading(true);
        const uaList = formUaWhitelist.split(',').map(s => s.trim()).filter(Boolean);

        let duration = parseFloat(formCacheDuration);
        if (isNaN(duration) || duration < 0) duration = 24;
        if (formDurationUnit === 'minutes') {
            duration = duration / 60;
        }

        await addUpstreamSource(formName.trim(), formUrl.trim(), duration, uaList);
        setLoading(false);
        resetForm();
        setIsAdding(false);
        success('上游源添加成功');
        window.location.reload();
    };

    const handleUpdate = async () => {
        if (!editingSource) return;
        if (!validateForm()) return;

        setLoading(true);
        const uaList = formUaWhitelist.split(',').map(s => s.trim()).filter(Boolean);

        let duration = parseFloat(formCacheDuration);
        if (isNaN(duration) || duration < 0) duration = 24;
        if (formDurationUnit === 'minutes') {
            duration = duration / 60;
        }

        await updateUpstreamSource(
            editingSource.name,
            formName.trim(),
            formUrl.trim(),
            duration,
            uaList
        );

        setLoading(false);
        resetForm();
        setEditingSource(null);
        success('上游源更新成功');
        window.location.reload();
    };

    const handleDelete = async (sourceName: string) => {
        if (!await confirm(`确定要删除上游源 "${sourceName}" 吗？\n\n这将同时删除该上游源的所有节点、策略组和规则数据。`, { confirmColor: 'red', confirmText: '删除' })) {
            return;
        }

        setLoading(true);
        await deleteUpstreamSource(sourceName);
        setLoading(false);
        success('上游源已删除');
        window.location.reload();
    };

    const handleForceRefresh = async () => {
        if (!await confirm('确定要强制刷新所有上游源吗？\n\n这将重新获取所有上游订阅数据并清空所有订阅缓存。')) {
            return;
        }

        setLoading(true);
        const result = await forceRefreshUpstream();
        setLoading(false);

        if (result.success) {
            success('上游源刷新成功！');
            window.location.reload();
        } else {
            error('上游源刷新失败，请查看日志');
        }
    };

    const handleRefreshSingle = async (sourceName: string) => {
        if (!await confirm(`确定要刷新上游源 "${sourceName}" 吗？\n\n这将重新获取该上游源的订阅数据。`)) {
            return;
        }

        setLoading(true);
        const result = await refreshSingleSource(sourceName);
        setLoading(false);

        if (result.success) {
            success(`上游源 "${sourceName}" 刷新成功！`);
            window.location.reload();
        } else {
            error(`上游源 "${sourceName}" 刷新失败，请查看日志`);
        }
    };

    const handleSetDefault = async (sourceName: string) => {
        setLoading(true);
        try {
            const result = await setDefaultUpstreamSource(sourceName);
            setLoading(false);

            if (result.success) {
                success(`已将 "${sourceName}" 设为默认源`);
                window.location.reload();
            } else {
                error(`设置默认源失败`);
            }
        } catch (e) {
            setLoading(false);
            error(`设置默认源失败: ${e}`);
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
            <Modal
                isOpen={isAdding || !!editingSource}
                onClose={() => {
                    resetForm();
                    setEditingSource(null);
                    setIsAdding(false);
                }}
                title={editingSource ? '编辑上游源' : '添加新的上游源'}
            >
                {(isAdding || editingSource) && (
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
                            <label className="block text-sm font-semibold text-gray-700 mb-2">缓存时长</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={formCacheDuration}
                                    onChange={(e) => setFormCacheDuration(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    min="0.1"
                                    step="0.1"
                                />
                                <select
                                    value={formDurationUnit}
                                    onChange={(e) => setFormDurationUnit(e.target.value as 'hours' | 'minutes')}
                                    className="border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                >
                                    <option value="hours">小时</option>
                                    <option value="minutes">分钟</option>
                                </select>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                设置多久从上游源重新获取一次订阅数据。设置 0 表示永不失效 (仅手动刷新)。
                                {formCacheDuration !== '0' && (
                                    <span>(当前: {formDurationUnit === 'minutes' ? `${formCacheDuration}分钟` : `${formCacheDuration}小时`})</span>
                                )}
                            </p>
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

                        <div className="flex gap-2">
                            <button
                                onClick={editingSource ? handleUpdate : handleAdd}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                            >
                                {loading ? (editingSource ? '更新中...' : '添加中...') : (editingSource ? '确认更新' : '确认添加')}
                            </button>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setEditingSource(null);
                                    setIsAdding(false);
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {
                sources.length === 0 ? (
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
                                        <div className="flex flex-wrap gap-2 text-xs mb-2">
                                            <span className={(source.cacheDuration === 0 || Number(source.cacheDuration) === 0) ? "bg-purple-50 text-purple-600 px-2 py-1 rounded" : "bg-blue-50 text-blue-600 px-2 py-1 rounded"}>
                                                {(source.cacheDuration === 0 || Number(source.cacheDuration) === 0)
                                                    ? '♾️ 永不失效'
                                                    : `🕒 ${(source.cacheDuration ?? 24) < 1
                                                        ? `${Math.round((source.cacheDuration ?? 0) * 60)}m`
                                                        : `${source.cacheDuration ?? 24}h`}`
                                                }
                                            </span>
                                            {source.uaWhitelist && source.uaWhitelist.length > 0 && (
                                                <span className="bg-green-50 text-green-600 px-2 py-1 rounded">
                                                    🔒 UA限制
                                                </span>
                                            )}
                                            {source.lastUpdated && (
                                                <span className={`px-2 py-1 rounded flex items-center gap-1 ${source.status === 'failure' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                    {source.status === 'failure' ? '❌' : '✅'}
                                                    {formatDistanceToNow(source.lastUpdated, { addSuffix: true, locale: zhCN })}
                                                </span>
                                            )}
                                            {source.status === 'failure' && source.error && (
                                                <span className="bg-red-50 text-red-600 px-2 py-1 rounded" title={source.error}>
                                                    ⚠️ {source.error}
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
                )
            }
        </div >
    );
}
