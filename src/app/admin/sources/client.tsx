'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addUpstreamSource, deleteUpstreamSource, updateUpstreamSource, forceRefreshUpstream, refreshSingleSource, setDefaultUpstreamSource, toggleUpstreamSourceEnabled } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import RefreshApiModal from './RefreshApiModal';
import { SubmitButton } from '@/components/SubmitButton';

interface UpstreamSource {
    name: string;
    url: string;
    cacheDuration?: number;
    enabled?: boolean;
    isDefault?: boolean;
    lastUpdated?: number;
    status?: 'pending' | 'success' | 'failure';
    error?: string;
    traffic?: {
        upload: number;
        download: number;
        total: number;
        expire: number;
    };
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function UpstreamSourcesClient({ sources: initialSources, currentApiKey }: { sources: UpstreamSource[], currentApiKey?: string }) {
    const router = useRouter();
    const { success, error, info, addToast, updateToast, removeToast } = useToast();
    const { confirm } = useConfirm();
    const [sources, setSources] = useState<UpstreamSource[]>(initialSources);
    const [isAdding, setIsAdding] = useState(false);
    const [editingSource, setEditingSource] = useState<UpstreamSource | null>(null);
    const [loadingSave, setLoadingSave] = useState(false);
    const [loadingSaveAndUpdate, setLoadingSaveAndUpdate] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false); // For refresh/delete operations
    const [showApiModal, setShowApiModal] = useState(false);

    // Stream Refresh Logic
    const handleStreamRefresh = async (sourceName?: string) => {
        const toastId = addToast(
            sourceName ? `正在刷新上游源 "${sourceName}"...` : '正在刷新所有上游源...',
            'info',
            Infinity // Persistent toast
        );
        setLoadingAction(true);

        try {
            const params = sourceName ? `?name=${encodeURIComponent(sourceName)}` : '';
            const res = await fetch(`/api/sources/stream-refresh${params}`, {
                cache: 'no-store'
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            if (!res.body) throw new Error('ReadableStream not supported');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                // Process all complete lines
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        updateToast(toastId, data.message, data.type);
                    } catch (e) {
                        console.error('JSON parse error:', e);
                    }
                }
            }

            // Final success state
            // updateToast(toastId, 'Refresh completed', 'success');
            // Allow user to see final message for a moment before removal
            setTimeout(() => removeToast(toastId), 2000);
            window.location.reload();

        } catch (e) {
            console.error('Refresh error:', e);
            updateToast(toastId, `刷新失败: ${e}`, 'error');
            // Keep error toast for a while
            setTimeout(() => removeToast(toastId), 5000);
        } finally {
            setLoadingAction(false);
        }
    };

    // Form state
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formCacheDuration, setFormCacheDuration] = useState<string>('24');
    const [formDurationUnit, setFormDurationUnit] = useState<'hours' | 'minutes'>('hours');

    const resetForm = () => {
        setFormName('');
        setFormUrl('');
        setFormCacheDuration('24');
        setFormDurationUnit('hours');
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

        setEditingSource(source);
        setIsAdding(false);
    };

    const handleAdd = async (shouldRefresh = false) => {
        if (!validateForm()) return;

        if (sources.some(s => s.name === formName.trim())) {
            error('上游源名称已存在');
            return;
        }

        if (shouldRefresh) {
            setLoadingSaveAndUpdate(true);
        } else {
            setLoadingSave(true);
        }


        let duration = parseFloat(formCacheDuration);
        if (isNaN(duration) || duration < 0) duration = 24;
        if (formDurationUnit === 'minutes') {
            duration = duration / 60;
        }

        await addUpstreamSource(
            formName.trim(),
            formUrl.trim(),
            duration,
            true, // enabled
            true // skipRefresh (Always skip server-side refresh, let client handle stream refresh)
        );
        const sourceName = formName.trim();

        if (shouldRefresh) {
            // Don't close modal, keep loading
            success('保存成功，正在更新...');
            await handleStreamRefresh(sourceName);
            // handleStreamRefresh will reload page, so no need to clean up state
        } else {
            setLoadingSave(false);
            resetForm();
            setIsAdding(false);
            success('上游源添加成功');
            window.location.reload();
        }
    };

    const handleToggleEnabled = async (source: UpstreamSource) => {
        const newStatus = !(source.enabled !== false);
        // Optimistic update
        setSources(prev => prev.map(s =>
            s.name === source.name ? { ...s, enabled: newStatus } : s
        ));

        try {
            await toggleUpstreamSourceEnabled(source.name, newStatus);
            success(`已${newStatus ? '启用' : '禁用'}源 "${source.name}"`);
        } catch (e) {
            // Revert on error
            setSources(prev => prev.map(s =>
                s.name === source.name ? { ...s, enabled: source.enabled } : s
            ));
            error('操作失败');
        }
    };

    const handleUpdate = async (shouldRefresh = false) => {
        if (!editingSource) return;
        if (!validateForm()) return;

        if (shouldRefresh) {
            setLoadingSaveAndUpdate(true);
        } else {
            setLoadingSave(true);
        }



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
            true,
            true // skipRefresh (Always skip server-side refresh, let client handle stream refresh)
        );

        const sourceName = formName.trim();

        if (shouldRefresh) {
            // Don't close modal, keep loading
            success('保存成功，正在更新...');
            await handleStreamRefresh(sourceName);
            // handleStreamRefresh will reload page
        } else {
            setLoadingSave(false);
            resetForm();
            setEditingSource(null);
            setIsAdding(false);
            success('上游源更新成功');
            window.location.reload();
        }
    };

    const handleDelete = async (sourceName: string) => {
        if (!await confirm(`确定要删除上游源 "${sourceName}" 吗？\n\n这将同时删除该上游源的所有节点、策略组和规则数据。`, { confirmColor: 'red', confirmText: '删除' })) {
            return;
        }

        setLoadingAction(true);
        await deleteUpstreamSource(sourceName);
        setLoadingAction(false);
        success('上游源已删除');
        window.location.reload();
    };

    const handleForceRefresh = async () => {
        if (!await confirm('确定要强制刷新所有上游源吗？\n\n这将重新获取所有上游订阅数据并清空所有订阅缓存。')) {
            return;
        }
        await handleStreamRefresh();
    };

    const handleRefreshSingle = async (sourceName: string) => {
        if (!await confirm(`确定要刷新上游源 "${sourceName}" 吗？\n\n这将重新获取该上游源的订阅数据。`)) {
            return;
        }
        await handleStreamRefresh(sourceName);
    };

    const handleSetDefault = async (sourceName: string) => {
        setLoadingAction(true);
        try {
            const result = await setDefaultUpstreamSource(sourceName);
            setLoadingAction(false);

            if (result.success) {
                success(`已将 "${sourceName}" 设为默认源`);
                window.location.reload();
            } else {
                error(`设置默认源失败`);
            }
        } catch (e) {
            setLoadingAction(false);
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
                        onClick={() => setShowApiModal(true)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                    >
                        🔗 刷新API
                    </button>
                    <button
                        onClick={handleForceRefresh}
                        disabled={loadingAction}
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


                        <div className="flex gap-2">
                            <SubmitButton
                                onClick={() => editingSource ? handleUpdate(false) : handleAdd(false)}
                                isLoading={loadingSave}
                                text={editingSource ? '保存' : '保存'}
                                className="flex-1"
                            />
                            <SubmitButton
                                onClick={() => editingSource ? handleUpdate(true) : handleAdd(true)}
                                isLoading={loadingSaveAndUpdate}
                                text={editingSource ? '保存并更新' : '保存并更新'}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            />
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

            {sources.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无上游源,点击上方按钮添加
                </div>
            ) : (
                <div className="space-y-4">
                    {sources.map((source, index) => (
                        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                {/* Left: Source Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-800">{source.name}</h3>

                                        <div className="flex items-center gap-2">
                                            {/* Enabled Toggle */}
                                            <button
                                                onClick={() => handleToggleEnabled(source)}
                                                disabled={loadingAction}
                                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${source.enabled !== false
                                                    ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                    }`}
                                                title={source.enabled !== false ? '点击禁用' : '点击启用'}
                                            >
                                                {source.enabled !== false ? '✅ 已启用' : '⛔ 已禁用'}
                                            </button>

                                            {source.isDefault ? (
                                                <span className="bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded text-xs font-medium">
                                                    ⭐ 默认
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleSetDefault(source.name)}
                                                    disabled={loadingAction}
                                                    className="bg-gray-50 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600 px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                                                    title="设为默认上游源"
                                                >
                                                    ☆ 设为默认
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 break-all mb-2">{source.url}</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className={(source.cacheDuration === 0 || Number(source.cacheDuration) === 0) ? "bg-purple-50 text-purple-600 px-2 py-1 rounded" : "bg-blue-50 text-blue-600 px-2 py-1 rounded"}>
                                            {(source.cacheDuration === 0 || Number(source.cacheDuration) === 0)
                                                ? '♾️ 永不自动失效'
                                                : `🕒 ${(source.cacheDuration ?? 24) < 1
                                                    ? `${Math.round((source.cacheDuration ?? 0) * 60)}m`
                                                    : `${source.cacheDuration ?? 24}h`}`
                                            }
                                        </span>

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

                                    {source.traffic && (
                                        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs border border-gray-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-gray-500 font-medium">流量使用</span>
                                                <span className="text-blue-600 font-bold">
                                                    {formatBytes(source.traffic.upload + source.traffic.download)} / {formatBytes(source.traffic.total)}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2 overflow-hidden">
                                                <div
                                                    className="bg-blue-500 h-1.5 rounded-full"
                                                    style={{ width: `${Math.min(((source.traffic.upload + source.traffic.download) / source.traffic.total) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-gray-500">
                                                <div>
                                                    ↑ {formatBytes(source.traffic.upload)}
                                                    <span className="mx-1">|</span>
                                                    ↓ {formatBytes(source.traffic.download)}
                                                </div>
                                                <div className="text-right text-gray-400">
                                                    {source.traffic.expire ? `过期: ${new Date(source.traffic.expire * 1000).toLocaleDateString()}` : '无过期时间'}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Action Buttons (Only 3) */}
                                <div className="flex md:flex-col gap-2 md:w-32 shrink-0">
                                    <button
                                        onClick={() => handleRefreshSingle(source.name)}
                                        disabled={loadingAction}
                                        className="flex-1 md:w-full bg-green-50 text-green-600 px-3 py-2 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors font-medium text-sm"
                                        title="刷新此上游源"
                                    >
                                        🔄 刷新
                                    </button>
                                    <button
                                        onClick={() => openEditModal(source)}
                                        disabled={loadingAction}
                                        className="flex-1 md:w-full bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors font-medium text-sm"
                                    >
                                        ✏️ 编辑
                                    </button>
                                    <button
                                        onClick={() => handleDelete(source.name)}
                                        disabled={loadingAction}
                                        className="flex-1 md:w-full bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors font-medium text-sm"
                                    >
                                        🗑️ 删除
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <RefreshApiModal
                isOpen={showApiModal}
                onClose={() => setShowApiModal(false)}
                currentApiKey={currentApiKey}
                sources={sources}
                onSave={async (apiKey) => {
                    const { updateRefreshApiKey } = await import('./actions');
                    return await updateRefreshApiKey(apiKey);
                }}
            />
        </div>
    );
}
