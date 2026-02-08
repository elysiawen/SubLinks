'use client';

import { useState, useEffect } from 'react';
import { updateAdminSubscription, deleteAdminSubscription, refreshSubscriptionCache, createAdminSubscription } from './actions';
import { ConfigSet } from '@/lib/config-actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';
import SubscriptionForm from '@/components/subscription-form';
import Search from '@/components/Search';
import Pagination from '@/components/Pagination';

interface Sub {
    token: string;
    username: string;
    remark: string;
    enabled: boolean;
    createdAt: number;
    customRules: string;
    groupId?: string;
    ruleId?: string;
    selectedSources?: string[];
    cacheTime?: number;
}

interface ConfigSets {
    groups: ConfigSet[];
    rules: ConfigSet[];
}

export default function AdminSubsClient({
    initialSubs,
    total,
    currentPage,
    itemsPerPage,
    configSets,
    defaultGroups,
    availableSources,
    users
}: {
    initialSubs: Sub[],
    total: number,
    itemsPerPage: number,
    currentPage: number,
    configSets: ConfigSets,
    defaultGroups: { name: string; source: string }[],
    availableSources: { name: string; url: string; enabled?: boolean }[],
    users: { username: string; nickname?: string }[]
}) {
    const { success, error, info, addToast, updateToast, removeToast } = useToast();
    const { confirm } = useConfirm();
    const [subs, setSubs] = useState<Sub[]>(initialSubs);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedUser, setSelectedUser] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRebuildModal, setShowRebuildModal] = useState(false);
    const [rebuildBatchSize, setRebuildBatchSize] = useState<number>(0); // 0 = full concurrency

    // Update subs when initialSubs changes (e.g. page navigation)
    useEffect(() => {
        setSubs(initialSubs);
    }, [initialSubs]);

    // Stream Rebuild Logic
    const handleStreamRebuild = async (batchSize: number = 0) => {
        const toastId = addToast(
            '正在重建所有订阅缓存...',
            'info',
            Infinity // Persistent toast
        );
        setLoading(true);

        try {
            const url = batchSize > 0
                ? `/api/subscriptions/stream-rebuild?force=true&batchSize=${batchSize}`
                : '/api/subscriptions/stream-rebuild?force=true';
            const res = await fetch(url, {
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

            // Allow user to see final message for a moment before removal
            setTimeout(() => removeToast(toastId), 2000);
            window.location.reload();

        } catch (e) {
            console.error('Rebuild error:', e);
            updateToast(toastId, `重建失败: ${e}`, 'error');
            // Keep error toast for a while
            setTimeout(() => removeToast(toastId), 5000);
        } finally {
            setLoading(false);
        }
    };

    // Stream Single Rebuild Logic
    const handleSingleRebuild = async (token: string, username: string, remark: string) => {
        const toastId = addToast(
            `正在重建 ${username} 的订阅...`,
            'info',
            Infinity
        );

        try {
            const res = await fetch(`/api/subscriptions/stream-rebuild?token=${encodeURIComponent(token)}`, {
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

            setTimeout(() => removeToast(toastId), 2000);
            window.location.reload();

        } catch (e) {
            console.error('Rebuild error:', e);
            updateToast(toastId, `重建失败: ${e}`, 'error');
            setTimeout(() => removeToast(toastId), 5000);
        }
    };

    const refresh = () => {
        window.location.reload();
    };

    const handleEdit = (sub: Sub) => {
        setEditingSub(sub);
    };

    const handleDelete = async (token: string) => {
        if (await confirm('确定要删除此订阅吗？删除后用户将无法恢复！', { confirmColor: 'red', confirmText: '彻底删除' })) {
            await deleteAdminSubscription(token);
            success('订阅已删除');
            refresh();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">
                    所有订阅管理
                    <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{total}</span>
                </h1>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            setSelectedUser('');
                            setIsCreating(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <span>➕</span>
                        新增订阅
                    </button>
                    <button
                        onClick={() => setShowRebuildModal(true)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>🔄</span>
                        重建所有缓存
                    </button>
                </div>
            </div>

            {subs.length === 0 ? (
                <div className="space-y-4">
                    <Search placeholder="搜索订阅..." />
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                        暂无任何订阅数据
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-4">
                        <Search placeholder="搜索订阅..." />
                    </div>
                    {/* Desktop View: Table */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-900 font-medium">
                                    <tr>
                                        <th className="px-6 py-4 whitespace-nowrap">备注 / Token</th>
                                        <th className="px-6 py-4 whitespace-nowrap">用户</th>
                                        <th className="px-6 py-4 whitespace-nowrap">缓存</th>
                                        <th className="px-6 py-4 whitespace-nowrap">上游源</th>
                                        <th className="px-6 py-4 whitespace-nowrap">配置</th>
                                        <th className="px-6 py-4 whitespace-nowrap">创建时间</th>
                                        <th className="px-6 py-4 whitespace-nowrap text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {subs.map((sub) => (
                                        <tr key={sub.token} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col max-w-[180px]">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${sub.enabled ? 'bg-green-500' : 'bg-red-500'}`} title={sub.enabled ? '启用' : '禁用'} />
                                                        <span className="truncate text-sm font-medium text-gray-700" title={sub.remark}>{sub.remark}</span>
                                                    </div>
                                                    <span className="truncate text-xs text-gray-400 font-mono" title={sub.token}>{sub.token}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{sub.username}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {sub.cacheTime ? (
                                                    sub.cacheTime > Date.now() ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded w-fit border border-blue-100">有效</span>
                                                            <span className="text-xs text-gray-400 mt-0.5" title={new Date(sub.cacheTime).toLocaleString()}>过期: {new Date(sub.cacheTime).toLocaleTimeString()}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded w-fit border border-green-100">已缓存</span>
                                                            <span className="text-xs text-gray-400 mt-0.5" title={new Date(sub.cacheTime).toLocaleString()}>更新: {new Date(sub.cacheTime).toLocaleString()}</span>
                                                        </div>
                                                    )
                                                ) : (
                                                    <span className="text-xs text-gray-300 italic">未缓存</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {(sub.selectedSources && sub.selectedSources.length > 0) ? (
                                                        sub.selectedSources.map(sourceName => {
                                                            const source = availableSources.find(s => s.name === sourceName);
                                                            if (!source) {
                                                                return (
                                                                    <span key={sourceName} className="px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-500 flex items-center gap-1" title="Source Deleted">
                                                                        🗑️ {sourceName}
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <span key={sourceName} className={`px-1.5 py-0.5 rounded border flex items-center gap-1 whitespace-nowrap ${source.enabled !== false
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                                    : 'bg-gray-100 text-gray-500 border-gray-200 line-through decoration-gray-400'
                                                                    }`}>
                                                                    {source.enabled !== false ? '✅' : '⛔'} {source.name}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-gray-400 italic">全部 (All)</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                <div className="space-y-1">
                                                    {sub.groupId && sub.groupId !== 'default' && <div className="text-purple-600 bg-purple-50 px-1 py-0.5 rounded w-fit">Group: Custom</div>}
                                                    {sub.ruleId && sub.ruleId !== 'default' && <div className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded w-fit">Rules: Custom</div>}
                                                    {!((sub.groupId && sub.groupId !== 'default') || (sub.ruleId && sub.ruleId !== 'default')) && <span className="text-gray-400">默认</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 text-xs whitespace-nowrap">
                                                {new Date(sub.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                                <button
                                                    onClick={async () => {
                                                        if (await confirm('确定要重建此订阅的缓存吗？')) {
                                                            await handleSingleRebuild(sub.token, sub.username, sub.remark);
                                                        }
                                                    }}
                                                    className="text-green-600 hover:text-blue-800 font-medium"
                                                    title="重建缓存 (清除并立即生成)"
                                                >
                                                    重建
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(sub)}
                                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    编辑
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(sub.token)}
                                                    className="text-red-400 hover:text-red-600 font-medium"
                                                >
                                                    删除
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="md:hidden space-y-4">
                        {subs.map((sub, index) => (
                            <div
                                key={sub.token}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 animate-slide-in-up"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-gray-800 text-lg">{sub.username}</div>
                                        <div className="text-sm text-gray-500 mt-0.5">{sub.remark}</div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${sub.enabled ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                        {sub.enabled ? '启用' : '禁用'}
                                    </span>
                                </div>

                                <div className="text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded break-all border border-gray-100">
                                    Token: {sub.token}
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-gray-500">缓存:</span>
                                    {sub.cacheTime ? (
                                        sub.cacheTime > Date.now() ? (
                                            <span className="text-blue-600">有效 (过期: {new Date(sub.cacheTime).toLocaleTimeString()})</span>
                                        ) : (
                                            <span className="text-green-600">已缓存 (更新: {new Date(sub.cacheTime).toLocaleString()})</span>
                                        )
                                    ) : (
                                        <span className="text-gray-400">未缓存</span>
                                    )}
                                </div>

                                <div className="text-xs flex items-center gap-2">
                                    <div className="font-semibold text-gray-500 shrink-0">使用源:</div>
                                    <div className="flex flex-wrap gap-1">
                                        {(sub.selectedSources && sub.selectedSources.length > 0) ? (
                                            sub.selectedSources.map(sourceName => {
                                                const source = availableSources.find(s => s.name === sourceName);
                                                if (!source) {
                                                    return (
                                                        <span key={sourceName} className="px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-500 flex items-center gap-1">
                                                            🗑️ {sourceName}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span key={sourceName} className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${source.enabled !== false
                                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                        : 'bg-gray-100 text-gray-500 border-gray-200 line-through decoration-gray-400'
                                                        }`}>
                                                        {source.enabled !== false ? '✅' : '⛔'} {source.name}
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="text-gray-400 italic">全部 (All)</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs">
                                    {sub.groupId && sub.groupId !== 'default' && (
                                        <div className="text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 font-medium">
                                            策略: Custom
                                        </div>
                                    )}
                                    {sub.ruleId && sub.ruleId !== 'default' && (
                                        <div className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 font-medium">
                                            规则: Custom
                                        </div>
                                    )}
                                    {!((sub.groupId && sub.groupId !== 'default') || (sub.ruleId && sub.ruleId !== 'default')) && (
                                        <div className="text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                            默认配置
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-xs text-gray-400">
                                    <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                                    <div className="flex gap-4 text-sm font-medium">
                                        <button
                                            onClick={async () => {
                                                if (await confirm('确定要重建此订阅的缓存吗？')) {
                                                    await handleSingleRebuild(sub.token, sub.username, sub.remark);
                                                }
                                            }}
                                            className="text-green-600 hover:text-green-800 font-medium"
                                        >
                                            重建
                                        </button>
                                        <button
                                            onClick={() => handleEdit(sub)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sub.token)}
                                            className="text-red-400 hover:text-red-600"
                                        >
                                            删除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )
            }

            {/* Create Modal */}
            <Modal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                title="为用户新增订阅"
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    {/* User Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">选择用户</label>
                        <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                            value={selectedUser}
                            onChange={e => setSelectedUser(e.target.value)}
                        >
                            <option value="">请选择用户...</option>
                            {users.map(u => (
                                <option key={u.username} value={u.username}>
                                    {u.nickname ? `${u.nickname} (${u.username})` : u.username}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedUser && (
                        <SubscriptionForm
                            configSets={configSets}
                            defaultGroups={defaultGroups}
                            availableSources={availableSources}
                            isAdmin={false}
                            onSubmit={async (data) => {
                                setLoading(true);
                                const result = await createAdminSubscription(selectedUser, {
                                    remark: data.name,
                                    customRules: data.customRules,
                                    groupId: data.groupId,
                                    ruleId: data.ruleId,
                                    selectedSources: data.selectedSources
                                });
                                setLoading(false);

                                if (result.error) {
                                    error(result.error);
                                    return;
                                }

                                setIsCreating(false);
                                success(`已为用户 ${selectedUser} 创建订阅`);
                                refresh();
                            }}
                            onCancel={() => setIsCreating(false)}
                            submitLabel="创建订阅"
                        />
                    )}

                    {!selectedUser && (
                        <div className="text-center py-8 text-gray-400">
                            请先选择一个用户
                        </div>
                    )}
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingSub}
                onClose={() => setEditingSub(null)}
                title={`编辑订阅 - ${editingSub?.username}`}
            >
                {editingSub && (
                    <SubscriptionForm
                        initialData={{
                            name: editingSub.remark, // Admin uses remark
                            enabled: editingSub.enabled,
                            groupId: editingSub.groupId || 'default',
                            ruleId: editingSub.ruleId || 'default',
                            customRules: editingSub.customRules,
                            selectedSources: editingSub.selectedSources || []
                        }}
                        configSets={configSets}
                        defaultGroups={defaultGroups}
                        availableSources={availableSources}
                        isAdmin={true}
                        onSubmit={async (data) => {
                            setLoading(true);
                            await updateAdminSubscription(editingSub.token, {
                                remark: data.name, // Mapped back to remark
                                enabled: data.enabled,
                                groupId: data.groupId,
                                ruleId: data.ruleId,
                                customRules: data.customRules,
                                selectedSources: data.selectedSources
                            });
                            setLoading(false);
                            setEditingSub(null);
                            success('订阅更新成功');
                            refresh();
                        }}
                        onCancel={() => setEditingSub(null)}
                        submitLabel="保存更改"
                    />
                )}
            </Modal>

            {/* Rebuild Configuration Modal */}
            <Modal
                isOpen={showRebuildModal}
                onClose={() => setShowRebuildModal(false)}
                title="重建订阅缓存配置"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        选择重建方式。全并发速度最快，但可能对服务器造成较大压力。批量处理更稳定，适合订阅数量较多的情况。
                    </p>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 0}
                                onChange={() => setRebuildBatchSize(0)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">全并发处理</div>
                                <div className="text-xs text-gray-500">同时处理所有订阅，速度最快（推荐订阅数 &lt; 100）</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 10}
                                onChange={() => setRebuildBatchSize(10)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">批量处理（每批 10 个）</div>
                                <div className="text-xs text-gray-500">适中的速度和服务器压力</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 5}
                                onChange={() => setRebuildBatchSize(5)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">批量处理（每批 5 个）</div>
                                <div className="text-xs text-gray-500">较慢但更稳定，适合订阅数量很多的情况</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 1}
                                onChange={() => setRebuildBatchSize(1)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">逐个处理</div>
                                <div className="text-xs text-gray-500">最慢但最稳定，适合调试或服务器资源有限的情况</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize > 1 && rebuildBatchSize !== 5 && rebuildBatchSize !== 10}
                                onChange={() => setRebuildBatchSize(20)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">自定义批次大小</div>
                                {(rebuildBatchSize > 1 && rebuildBatchSize !== 5 && rebuildBatchSize !== 10) && (
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={rebuildBatchSize}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 1;
                                            setRebuildBatchSize(Math.max(1, Math.min(1000, val)));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="输入批次大小（1-1000）"
                                    />
                                )}
                                <div className="text-xs text-gray-500 mt-1">自定义每批处理的订阅数量</div>
                            </div>
                        </label>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-800">
                            ⚠️ 此操作将清除所有现有缓存并重新生成。当前共有 <strong>{total}</strong> 个订阅需要处理。
                        </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={async () => {
                                setShowRebuildModal(false);
                                await handleStreamRebuild(rebuildBatchSize);
                            }}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            开始重建
                        </button>
                        <button
                            onClick={() => setShowRebuildModal(false)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            取消
                        </button>
                    </div>
                </div>
            </Modal>

            <Pagination
                total={total}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
            />
        </div >
    );
}
