'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useErrors } from '@/lib/use-errors';
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
    total: initialTotal,
    currentPage,
    itemsPerPage,
    configSets,
    defaultGroups,
    availableSources,
    proxySourceMap,
    users
}: {
    initialSubs: Sub[],
    total: number,
    itemsPerPage: number,
    currentPage: number,
    configSets: ConfigSets,
    defaultGroups: { name: string; source: string }[],
    availableSources: { name: string; url?: string; enabled?: boolean }[],
    proxySourceMap: Record<string, string>,
    users: { username: string; nickname?: string }[]
}) {
    const t = useTranslations('admin.subscriptions');
    const { success, error, info, addToast, updateToast, removeToast } = useToast();
    const { confirm } = useConfirm();
    const tError = useErrors();
    const [subs, setSubs] = useState<Sub[]>(initialSubs);
    const [total, setTotal] = useState(initialTotal);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedUser, setSelectedUser] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRebuildModal, setShowRebuildModal] = useState(false);
    const [rebuildBatchSize, setRebuildBatchSize] = useState<number>(0); // 0 = full concurrency

    // Update subs when initialSubs changes (e.g. page navigation)
    useEffect(() => {
        setSubs(initialSubs);
        setTotal(initialTotal);
    }, [initialSubs, initialTotal]);

    // Stream Rebuild Logic
    const handleStreamRebuild = async (batchSize: number = 0) => {
        const toastId = addToast(
            t('rebuildingAll'),
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
            let hasError = false;

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
                        if (data.type === 'error') hasError = true;
                    } catch (e) {
                        console.error('JSON parse error:', e);
                    }
                }
            }

            setTimeout(() => removeToast(toastId), 2000);
            if (!hasError) {
                setSubs(prev => prev.map(s => ({ ...s, cacheTime: Date.now() })));
            }

        } catch (e) {
            console.error('Rebuild error:', e);
            updateToast(toastId, t('rebuildFailed', { error: String(e) }), 'error');
            // Keep error toast for a while
            setTimeout(() => removeToast(toastId), 5000);
        } finally {
            setLoading(false);
        }
    };

    // Stream Single Rebuild Logic
    const handleSingleRebuild = async (token: string, username: string, remark: string) => {
        const toastId = addToast(
            t('rebuildingSingle', { username }),
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
            let hasError = false;

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
                        if (data.type === 'error') hasError = true;
                    } catch (e) {
                        console.error('JSON parse error:', e);
                    }
                }
            }

            setTimeout(() => removeToast(toastId), 2000);
            if (!hasError) {
                setSubs(prev => prev.map(s => s.token === token ? { ...s, cacheTime: Date.now() } : s));
            }

        } catch (e) {
            console.error('Rebuild error:', e);
            updateToast(toastId, t('rebuildFailed', { error: String(e) }), 'error');
            setTimeout(() => removeToast(toastId), 5000);
        }
    };

    const handleEdit = (sub: Sub) => {
        setEditingSub(sub);
    };

    const handleDelete = async (token: string) => {
        if (await confirm(t('confirmDelete'), { confirmColor: 'red', confirmText: t('confirmDeleteText') })) {
            const result = await deleteAdminSubscription(token);
            if (result?.error) {
                error(tError(result.error));
                return;
            }
            setSubs(prev => prev.filter(s => s.token !== token));
            setTotal(prev => prev - 1);
            success(t('subDeleted'));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-primary">
                    {t('title')}
                    <span className="ml-2 text-sm font-normal text-text-tertiary bg-muted px-2 py-1 rounded-full">{total}</span>
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
                        {t('addSubscription')}
                    </button>
                    <button
                        onClick={() => setShowRebuildModal(true)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/25 rounded-lg text-sm font-medium transition-colors border border-green-200 dark:border-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>🔄</span>
                        {t('rebuildAllCache')}
                    </button>
                </div>
            </div>

            {subs.length === 0 ? (
                <div className="space-y-4">
                    <Search placeholder={t('searchPlaceholder')} />
                    <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-text-quaternary">
                        {t('noSubscriptions')}
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-4">
                        <Search placeholder={t('searchPlaceholder')} />
                    </div>
                    {/* Desktop View: Table */}
                    <div className="hidden md:block bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left text-sm text-text-secondary">
                                <thead className="bg-surface text-text-primary font-medium">
                                    <tr>
                                        <th className="px-6 py-4 whitespace-nowrap">{t('tableRemark')}</th>
                                        <th className="px-6 py-4 whitespace-nowrap">{t('tableUser')}</th>
                                        <th className="px-6 py-4 whitespace-nowrap">{t('tableCache')}</th>
                                        <th className="px-6 py-4 whitespace-nowrap">{t('tableSources')}</th>
                                        <th className="px-6 py-4 whitespace-nowrap">{t('tableConfig')}</th>
                                        <th className="px-6 py-4 whitespace-nowrap">{t('tableCreatedAt')}</th>
                                        <th className="px-6 py-4 whitespace-nowrap text-right">{t('tableActions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {subs.map((sub) => (
                                        <tr key={sub.token} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col max-w-[180px]">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${sub.enabled ? 'bg-green-500' : 'bg-red-500'}`} title={sub.enabled ? t('enabled') : t('disabled')} />
                                                        <span className="truncate text-sm font-medium text-text-secondary" title={sub.remark}>{sub.remark}</span>
                                                    </div>
                                                    <span className="truncate text-xs text-text-quaternary font-mono" title={sub.token}>{sub.token}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-text-primary whitespace-nowrap">{sub.username}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {sub.cacheTime ? (
                                                    sub.cacheTime > Date.now() ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded w-fit border border-blue-200 dark:border-blue-800">{t('cacheValid')}</span>
                                                            <span className="text-xs text-text-quaternary mt-0.5" title={new Date(sub.cacheTime).toLocaleString()}>{t('cacheExpired')}: {new Date(sub.cacheTime).toLocaleTimeString()}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-1 rounded w-fit border border-green-100 dark:border-green-800">{t('cacheCached')}</span>
                                                            <span className="text-xs text-text-quaternary mt-0.5" title={new Date(sub.cacheTime).toLocaleString()}>{t('cacheUpdate')}: {new Date(sub.cacheTime).toLocaleString()}</span>
                                                        </div>
                                                    )
                                                ) : (
                                                    <span className="text-xs text-text-tertiary italic">{t('cacheNotCached')}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {(sub.selectedSources && sub.selectedSources.length > 0) ? (
                                                        sub.selectedSources.map(sourceName => {
                                                            const source = availableSources.find(s => s.name === sourceName);
                                                            if (!source) {
                                                                return (
                                                                    <span key={sourceName} className="px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400 flex items-center gap-1" title="Source Deleted">
                                                                        🗑️ {sourceName}
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <span key={sourceName} className={`px-1.5 py-0.5 rounded border flex items-center gap-1 whitespace-nowrap ${source.enabled !== false
                                                                    ? 'bg-accent text-accent-foreground border-blue-200 dark:border-blue-800'
                                                                    : 'bg-muted text-text-tertiary border-border-strong line-through decoration-gray-400 dark:decoration-gray-600'
                                                                    }`}>
                                                                    {source.enabled !== false ? '✅' : '⛔'} {source.name}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-text-quaternary italic">{t('allSources')}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                <div className="space-y-1">
                                                    {sub.groupId && sub.groupId !== 'default' && <div className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/15 px-1 py-0.5 rounded w-fit">Group: Custom</div>}
                                                    {sub.ruleId && sub.ruleId !== 'default' && <div className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 px-1 py-0.5 rounded w-fit">Rules: Custom</div>}
                                                    {!((sub.groupId && sub.groupId !== 'default') || (sub.ruleId && sub.ruleId !== 'default')) && <span className="text-text-quaternary">{t('configDefault')}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-text-quaternary text-xs whitespace-nowrap">
                                                {new Date(sub.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                                <button
                                                    onClick={async () => {
                                                        if (await confirm(t('confirmRebuild'))) {
                                                            await handleSingleRebuild(sub.token, sub.username, sub.remark);
                                                        }
                                                    }}
                                                    className="text-green-600 dark:text-green-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                                                    title={t('confirmRebuild')}
                                                >
                                                    {t('rebuild')}
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(sub)}
                                                    className="text-accent-foreground hover:text-blue-800 font-medium"
                                                >
                                                    {t('edit')}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(sub.token)}
                                                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium"
                                                >
                                                    {t('delete')}
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
                                className="bg-card p-4 rounded-xl shadow-sm border border-border flex flex-col gap-3 animate-slide-in-up"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-text-primary text-lg">{sub.username}</div>
                                        <div className="text-sm text-text-tertiary mt-0.5">{sub.remark}</div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${sub.enabled ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800'}`}>
                                        {sub.enabled ? t('enabled') : t('disabled')}
                                    </span>
                                </div>

                                <div className="text-xs text-text-quaternary font-mono bg-muted p-2 rounded break-all border border-border">
                                    Token: {sub.token}
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-text-tertiary">{t('mobileCache')}</span>
                                    {sub.cacheTime ? (
                                        sub.cacheTime > Date.now() ? (
                                            <span className="text-accent-foreground">{t('cacheValid')} ({t('cacheExpired')}: {new Date(sub.cacheTime).toLocaleTimeString()})</span>
                                        ) : (
                                            <span className="text-green-600 dark:text-green-400">{t('cacheCached')} ({t('cacheUpdate')}: {new Date(sub.cacheTime).toLocaleString()})</span>
                                        )
                                    ) : (
                                        <span className="text-text-quaternary">{t('cacheNotCached')}</span>
                                    )}
                                </div>

                                <div className="text-xs flex items-center gap-2">
                                    <div className="font-semibold text-text-tertiary shrink-0">{t('mobileSources')}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {(sub.selectedSources && sub.selectedSources.length > 0) ? (
                                            sub.selectedSources.map(sourceName => {
                                                const source = availableSources.find(s => s.name === sourceName);
                                                if (!source) {
                                                    return (
                                                        <span key={sourceName} className="px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400 flex items-center gap-1">
                                                            🗑️ {sourceName}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span key={sourceName} className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${source.enabled !== false
                                                        ? 'bg-accent text-accent-foreground border-blue-200 dark:border-blue-800'
                                                        : 'bg-muted text-text-tertiary border-border-strong line-through decoration-gray-400 dark:decoration-gray-600'
                                                        }`}>
                                                        {source.enabled !== false ? '✅' : '⛔'} {source.name}
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="text-text-quaternary italic">{t('allSources')}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs">
                                    {sub.groupId && sub.groupId !== 'default' && (
                                        <div className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/15 px-2 py-1 rounded border border-purple-100 dark:border-purple-800 font-medium">
                                            {t('configGroup')}
                                        </div>
                                    )}
                                    {sub.ruleId && sub.ruleId !== 'default' && (
                                        <div className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800 font-medium">
                                            {t('configRule')}
                                        </div>
                                    )}
                                    {!((sub.groupId && sub.groupId !== 'default') || (sub.ruleId && sub.ruleId !== 'default')) && (
                                        <div className="text-text-tertiary bg-muted px-2 py-1 rounded border border-border-strong">
                                            {t('configDefault')}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-muted text-xs text-text-quaternary">
                                    <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                                    <div className="flex gap-4 text-sm font-medium">
                                        <button
                                            onClick={async () => {
                                                if (await confirm(t('confirmRebuild'))) {
                                                    await handleSingleRebuild(sub.token, sub.username, sub.remark);
                                                }
                                            }}
                                            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
                                        >
                                            {t('rebuild')}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(sub)}
                                            className="text-accent-foreground hover:text-blue-800 dark:hover:text-blue-300"
                                        >
                                            {t('edit')}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sub.token)}
                                            className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                                        >
                                            {t('delete')}
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
                title={t('createTitle')}
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    {/* User Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">{t('selectUser')}</label>
                        <select
                            className="w-full border border-border-input rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-card"
                            value={selectedUser}
                            onChange={e => setSelectedUser(e.target.value)}
                        >
                            <option value="">{t('selectUserPlaceholder')}</option>
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
                            proxySourceMap={proxySourceMap}
                            isAdmin={false}
                            onSubmit={async (data) => {
                                setLoading(true);
                                const result = await createAdminSubscription(selectedUser, {
                                    remark: data.name || t('unnamed'),
                                    customRules: data.customRules,
                                    groupId: data.groupId,
                                    ruleId: data.ruleId,
                                    selectedSources: data.selectedSources
                                });
                                setLoading(false);

                                if (result.error) {
                                    error(tError(result.error));
                                    return;
                                }

                                if (result.token) {
                                    setSubs(prev => [{
                                        token: result.token,
                                        username: selectedUser,
                                        remark: data.name || t('unnamed'),
                                        enabled: true,
                                        createdAt: Date.now(),
                                        customRules: data.customRules,
                                        groupId: data.groupId,
                                        ruleId: data.ruleId,
                                        selectedSources: data.selectedSources,
                                    }, ...prev]);
                                    setTotal(prev => prev + 1);
                                }

                                setIsCreating(false);
                                success(t('subCreated', { username: selectedUser }));
                            }}
                            onCancel={() => setIsCreating(false)}
                            submitLabel={t('createLabel')}
                        />
                    )}

                    {!selectedUser && (
                        <div className="text-center py-8 text-text-quaternary">
                            {t('selectUserHint')}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingSub}
                onClose={() => setEditingSub(null)}
                title={t('editTitle', { username: editingSub?.username || '' })}
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
                        proxySourceMap={proxySourceMap}
                        isAdmin={true}
                        onSubmit={async (data) => {
                            setLoading(true);
                            const result = await updateAdminSubscription(editingSub.token, {
                                remark: data.name, // Mapped back to remark
                                enabled: data.enabled,
                                groupId: data.groupId,
                                ruleId: data.ruleId,
                                customRules: data.customRules,
                                selectedSources: data.selectedSources
                            });
                            setLoading(false);

                            if (result?.error) {
                                error(tError(result.error));
                                return;
                            }

                            setSubs(prev => prev.map(s => s.token === editingSub.token ? {
                                ...s,
                                remark: data.name,
                                enabled: data.enabled,
                                groupId: data.groupId,
                                ruleId: data.ruleId,
                                customRules: data.customRules,
                                selectedSources: data.selectedSources,
                            } : s));
                            setEditingSub(null);
                            success(t('subUpdated'));
                        }}
                        onCancel={() => setEditingSub(null)}
                        submitLabel={t('saveLabel')}
                    />
                )}
            </Modal>

            {/* Rebuild Configuration Modal */}
            <Modal
                isOpen={showRebuildModal}
                onClose={() => setShowRebuildModal(false)}
                title={t('rebuildTitle')}
            >
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary">
                        {t('rebuildDesc')}
                    </p>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 0}
                                onChange={() => setRebuildBatchSize(0)}
                                className="w-4 h-4 text-accent-foreground"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-text-primary">{t('fullConcurrency')}</div>
                                <div className="text-xs text-text-tertiary">{t('fullConcurrencyDesc')}</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 10}
                                onChange={() => setRebuildBatchSize(10)}
                                className="w-4 h-4 text-accent-foreground"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-text-primary">{t('batch10')}</div>
                                <div className="text-xs text-text-tertiary">{t('batch10Desc')}</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 5}
                                onChange={() => setRebuildBatchSize(5)}
                                className="w-4 h-4 text-accent-foreground"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-text-primary">{t('batch5')}</div>
                                <div className="text-xs text-text-tertiary">{t('batch5Desc')}</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize === 1}
                                onChange={() => setRebuildBatchSize(1)}
                                className="w-4 h-4 text-accent-foreground"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-text-primary">{t('batch1')}</div>
                                <div className="text-xs text-text-tertiary">{t('batch1Desc')}</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <input
                                type="radio"
                                checked={rebuildBatchSize > 1 && rebuildBatchSize !== 5 && rebuildBatchSize !== 10}
                                onChange={() => setRebuildBatchSize(20)}
                                className="w-4 h-4 text-accent-foreground"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-text-primary">{t('customBatch')}</div>
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
                                        className="mt-2 w-full border border-border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder={t('customBatchPlaceholder')}
                                    />
                                )}
                                <div className="text-xs text-text-tertiary mt-1">{t('customBatchDesc')}</div>
                            </div>
                        </label>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-800">
                            ⚠️ {t('rebuildWarning', { total })}
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
                            {t('startRebuild')}
                        </button>
                        <button
                            onClick={() => setShowRebuildModal(false)}
                            className="px-4 py-2 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium"
                        >
                            {t('cancel')}
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
