'use client';

import { useState, useEffect } from 'react';
import { createSubscription, deleteSubscription, updateSubscription, toggleSubscriptionEnabled } from '@/lib/sub-actions';
import { ConfigSet } from '@/lib/config-actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { getGroupSets, getRuleSets, getProxyGroups, getUpstreamSources, getProxySourceMap } from '@/lib/config-actions';
import Modal from '@/components/Modal';
import SubscriptionForm from '@/components/subscription-form';
import { useTranslations } from 'next-intl';
import { useErrors } from '@/lib/use-errors';

interface Sub {
    token: string;
    name: string;
    customRules: string;
    groupId?: string;
    ruleId?: string;
    selectedSources?: string[];
    enabled: boolean;
}

interface ConfigSets {
    groups: ConfigSet[];
    rules: ConfigSet[];
}

export default function SubscriptionsClient({ initialSubs, username, baseUrl, configSets: initialConfigSets, defaultGroups: initialDefaultGroups = [], availableSources: initialAvailableSources = [], proxySourceMap: initialProxySourceMap = {} }: { initialSubs: Sub[], username: string, baseUrl: string, configSets?: ConfigSets, defaultGroups?: { name: string; source: string }[], availableSources?: { name: string; url?: string; isDefault?: boolean; enabled?: boolean; status?: 'pending' | 'success' | 'failure'; lastUpdated?: number }[], proxySourceMap?: Record<string, string> }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const t = useTranslations('dashboard');
    const tError = useErrors();
    const [subs, setSubs] = useState<Sub[]>(initialSubs);

    // Data State
    const [configSets, setConfigSets] = useState<{ groups: ConfigSet[], rules: ConfigSet[] }>(initialConfigSets || { groups: [], rules: [] });
    const [defaultGroups, setDefaultGroups] = useState<{ name: string; source: string }[]>(initialDefaultGroups || []);
    const [availableSources, setAvailableSources] = useState<{ name: string; url?: string; isDefault?: boolean; enabled?: boolean; status?: 'pending' | 'success' | 'failure'; lastUpdated?: number }[]>(initialAvailableSources || []);
    const [proxySourceMap, setProxySourceMap] = useState<Record<string, string>>(initialProxySourceMap);
    const [dataLoaded, setDataLoaded] = useState(!!initialConfigSets);

    // Fetch additional data on mount if not provided
    useEffect(() => {
        if (!dataLoaded) {
            Promise.all([
                getGroupSets(),
                getRuleSets(),
                getProxyGroups(),
                getUpstreamSources(),
                getProxySourceMap()
            ]).then(([groups, rules, proxyGroups, sources, psm]) => {
                setConfigSets({ groups, rules });

                // Filter and map default groups
                const defaults = proxyGroups
                    .filter(g => g.source !== 'custom')
                    .map(g => ({ name: g.name, source: g.source }));
                setDefaultGroups(defaults);

                setAvailableSources(sources);
                setProxySourceMap(psm);
                setDataLoaded(true);
            }).catch(e => {
                console.error("Failed to load dashboard data", e);
                error(t('subscriptions.loadDataFailed'));
            });
        }
    }, [dataLoaded, error]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);

    const handleDelete = async (token: string) => {
        if (await confirm(t('subscriptions.deleteConfirm'), { confirmColor: 'red', confirmText: t('subscriptions.deleteConfirmButton') })) {
            const result = await deleteSubscription(token);
            if (result?.error) {
                error(tError(result.error));
                return;
            }
            setSubs(prev => prev.filter(s => s.token !== token));
            success(t('subscriptions.deleted'));
        }
    }

    const handleToggle = async (sub: Sub) => {
        const newStatus = !sub.enabled;

        // Optimistic update
        setSubs(prev => prev.map(s => s.token === sub.token ? { ...s, enabled: newStatus } : s));

        try {
            const result = await toggleSubscriptionEnabled(sub.token, newStatus);
            if (result.error) {
                error(tError(result.error));
                setSubs(prev => prev.map(s => s.token === sub.token ? { ...s, enabled: !newStatus } : s));
            } else {
                success(newStatus ? t('subscriptions.enabled') : t('subscriptions.disabled'));
            }
        } catch {
            error(t('subscriptions.actionFailed'));
            setSubs(prev => prev.map(s => s.token === sub.token ? { ...s, enabled: !newStatus } : s));
        }
    }

    const openCreate = () => {
        setEditingSub(null);
        setIsModalOpen(true);
    }

    const openEdit = (sub: Sub) => {
        setEditingSub(sub);
        setIsModalOpen(true);
    }

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSub(null);
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-text-primary">{t('subscriptions.heading', { count: subs.length })}</h2>
                <button
                    onClick={openCreate}
                    className="bg-accent-button text-white px-5 py-2.5 rounded-xl hover:bg-accent-button-hover shadow-lg shadow-accent-button/20 transition-all active:scale-95 text-sm font-medium"
                >
                    {t('subscriptions.addSubscription')}
                </button>
            </div>

            <div className="grid gap-5 grid-cols-1">
                {subs.map((sub, index) => {
                    const link = `${baseUrl}/api/s/${sub.token}`;
                    return (
                        <div
                            key={sub.token}
                            className="bg-card p-6 rounded-2xl shadow-sm border border-border relative hover:shadow-md transition-all duration-200 group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-bold text-text-primary">
                                            {sub.name}
                                        </h3>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sub.enabled ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800'}`}>
                                            {sub.enabled ? t('subscriptions.statusEnabled') : t('subscriptions.statusDisabled')}
                                        </span>
                                        {sub.groupId && sub.groupId !== 'default' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Custom Group</span>}
                                        {sub.ruleId && sub.ruleId !== 'default' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Custom Rules</span>}
                                    </div>
                                    <p className="text-xs text-text-quaternary font-mono mt-1 tracking-wide">Token: {sub.token}</p>
                                </div>
                                <div className="space-x-3">
                                    <button
                                        onClick={() => handleToggle(sub)}
                                        className={`text-sm hover:underline font-medium ${sub.enabled ? 'text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300' : 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300'}`}
                                    >
                                        {sub.enabled ? t('subscriptions.statusDisabled') : t('subscriptions.statusEnabled')}
                                    </button>
                                    <button onClick={() => openEdit(sub)} className="text-accent-foreground text-sm hover:underline font-medium">{t('custom.groups.edit')}</button>
                                    <button onClick={() => handleDelete(sub.token)} className="text-red-500 text-sm hover:underline font-medium">{t('custom.groups.delete')}</button>
                                </div>
                            </div>

                            <div className="bg-muted p-3 rounded-lg border border-border flex items-center justify-between mb-4 group-hover:border-blue-100 dark:group-hover:border-blue-800 transition-colors">
                                <code className="text-xs text-text-secondary break-all line-clamp-1 font-mono">{link}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(link);
                                        success(t('subscriptions.copySuccess'));
                                    }}
                                    className="ml-3 text-xs bg-card border border-border-strong px-3 py-1.5 rounded-md text-text-secondary hover:bg-muted hover:text-accent-foreground hover:border-blue-200 dark:hover:border-blue-800 transition-all shrink-0 font-medium"
                                >
                                    {t('subscriptions.copyLink')}
                                </button>
                            </div>

                            {/* Upstream Sources Display */}
                            <div className="mb-4 text-xs text-text-secondary">
                                <span className="font-semibold text-text-tertiary mr-2">{t('subscriptions.sourcesLabel')}</span>
                                <div className="inline-flex flex-wrap gap-2 mt-1">
                                    {(sub.selectedSources && sub.selectedSources.length > 0) ? (
                                        sub.selectedSources.map(sourceName => {
                                            const source = availableSources.find(s => s.name === sourceName);
                                            if (!source) {
                                                return (
                                                    <span key={sourceName} className="px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400 flex items-center gap-1">
                                                        🗑️ {sourceName} ({t('subscriptions.sourceDeleted')})
                                                    </span>
                                                );
                                            }
                                            return (
                                                <span key={sourceName} className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${source.enabled !== false
                                                    ? 'bg-accent text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800'
                                                    : 'bg-muted text-text-tertiary border-border-strong line-through decoration-border-strong'
                                                    }`}>
                                                    {source.enabled !== false ? '✅' : '⛔'} {source.name}
                                                </span>
                                            );
                                        })
                                    ) : (
                                        availableSources.map(source => (
                                            <span key={source.name} className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${source.enabled !== false
                                                ? 'bg-accent text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800'
                                                : 'bg-muted text-text-tertiary border-border-strong line-through decoration-border-strong'
                                                }`}>
                                                {source.enabled !== false ? '✅' : '⛔'} {source.name}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            {sub.customRules && (
                                <div className="text-xs text-text-tertiary">
                                    <span className="font-semibold text-text-quaternary">{t('subscriptions.customRulesLabel')}</span> {sub.customRules.length > 50 ? sub.customRules.substring(0, 50) + '...' : sub.customRules}
                                </div>
                            )}
                        </div>
                    )
                })}
                {subs.length === 0 && (
                    <div className="text-center py-16 text-text-quaternary bg-card rounded-2xl shadow-sm border border-dashed border-border-strong">
                        <p>{t('subscriptions.empty')}</p>
                        <button onClick={openCreate} className="mt-2 text-blue-500 hover:underline text-sm">{t('subscriptions.emptyAction')}</button>
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingSub ? t('subscriptions.editTitle') : t('subscriptions.createTitle')}
                maxWidth="max-w-lg"
            >
                <SubscriptionForm
                    initialData={editingSub ? {
                        name: editingSub.name,
                        enabled: editingSub.enabled,
                        groupId: editingSub.groupId || 'default',
                        ruleId: editingSub.ruleId || 'default',
                        customRules: editingSub.customRules,
                        selectedSources: editingSub.selectedSources || []
                    } : undefined}
                    configSets={configSets}
                    defaultGroups={defaultGroups}
                    availableSources={availableSources}
                    proxySourceMap={proxySourceMap}
                    onSubmit={async (data) => {
                        let result;
                        if (editingSub) {
                            result = await updateSubscription(
                                editingSub.token,
                                data.name,
                                data.customRules,
                                data.groupId,
                                data.ruleId,
                                data.selectedSources
                            );
                        } else {
                            result = await createSubscription(
                                data.name || t('subscriptions.unnamed'),
                                data.customRules,
                                data.groupId,
                                data.ruleId,
                                data.selectedSources
                            );
                        }

                        if (result && result.error) {
                            error(tError(result.error));
                            return;
                        }

                        if (editingSub) {
                            // Update local state
                            setSubs(prev => prev.map(s => s.token === editingSub.token ? {
                                ...s,
                                name: data.name,
                                customRules: data.customRules,
                                groupId: data.groupId,
                                ruleId: data.ruleId,
                                selectedSources: data.selectedSources,
                            } : s));
                        } else if (result && 'token' in result) {
                            // Add new subscription to local state
                            setSubs(prev => [...prev, {
                                token: result.token as string,
                                name: data.name || t('subscriptions.unnamed'),
                                customRules: data.customRules,
                                groupId: data.groupId,
                                ruleId: data.ruleId,
                                selectedSources: data.selectedSources,
                                enabled: true,
                            }]);
                        }

                        success(editingSub ? t('subscriptions.updated') : t('subscriptions.created'));
                        closeModal();
                    }}
                    onCancel={closeModal}
                    submitLabel={editingSub ? t('subscriptions.save') : t('subscriptions.create')}
                />
            </Modal>
        </div>
    );
}
