'use client';

import { useState, useEffect } from 'react';
import { createSubscription, deleteSubscription, updateSubscription, toggleSubscriptionEnabled } from '@/lib/sub-actions';
import { ConfigSet } from '@/lib/config-actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { getGroupSets, getRuleSets, getProxyGroups, getUpstreamSources } from '@/lib/config-actions';
import Modal from '@/components/Modal';
import SubscriptionForm from '@/components/subscription-form';

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

export default function SubscriptionsClient({ initialSubs, username, baseUrl, configSets: initialConfigSets, defaultGroups: initialDefaultGroups = [], availableSources: initialAvailableSources = [] }: { initialSubs: Sub[], username: string, baseUrl: string, configSets?: ConfigSets, defaultGroups?: { name: string; source: string }[], availableSources?: { name: string; url?: string; isDefault?: boolean; enabled?: boolean; status?: 'pending' | 'success' | 'failure'; lastUpdated?: number }[] }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [subs, setSubs] = useState<Sub[]>(initialSubs);

    // Data State
    const [configSets, setConfigSets] = useState<{ groups: ConfigSet[], rules: ConfigSet[] }>(initialConfigSets || { groups: [], rules: [] });
    const [defaultGroups, setDefaultGroups] = useState<{ name: string; source: string }[]>(initialDefaultGroups || []);
    const [availableSources, setAvailableSources] = useState<{ name: string; url?: string; isDefault?: boolean; enabled?: boolean; status?: 'pending' | 'success' | 'failure'; lastUpdated?: number }[]>(initialAvailableSources || []);
    const [dataLoaded, setDataLoaded] = useState(!!initialConfigSets);

    // Fetch additional data on mount if not provided
    useEffect(() => {
        if (!dataLoaded) {
            Promise.all([
                getGroupSets(),
                getRuleSets(),
                getProxyGroups(),
                getUpstreamSources()
            ]).then(([groups, rules, proxyGroups, sources]) => {
                setConfigSets({ groups, rules });

                // Filter and map default groups
                const defaults = proxyGroups
                    .filter(g => g.source !== 'custom')
                    .map(g => ({ name: g.name, source: g.source }));
                setDefaultGroups(defaults);

                setAvailableSources(sources);
                setDataLoaded(true);
            }).catch(e => {
                console.error("Failed to load dashboard data", e);
                error("加载配置数据失败，部分功能可能不可用");
            });
        }
    }, [dataLoaded, error]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);

    const refresh = async () => {
        window.location.reload();
    };

    const handleDelete = async (token: string) => {
        if (await confirm('确定删除此订阅?', { confirmColor: 'red', confirmText: '彻底删除' })) {
            await deleteSubscription(token);
            success('订阅已删除');
            refresh();
        }
    }

    const handleToggle = async (sub: Sub) => {
        const newStatus = !sub.enabled;
        const action = newStatus ? '启用' : '禁用';

        // Optimistic update
        setSubs(subs.map(s => s.token === sub.token ? { ...s, enabled: newStatus } : s));

        try {
            const result = await toggleSubscriptionEnabled(sub.token, newStatus);
            if (result.error) {
                error(result.error);
                // Revert on error
                setSubs(subs.map(s => s.token === sub.token ? { ...s, enabled: !newStatus } : s));
            } else {
                success(`订阅已${action}`);
                refresh();
            }
        } catch (err) {
            error('操作失败');
            // Revert on error
            setSubs(subs.map(s => s.token === sub.token ? { ...s, enabled: !newStatus } : s));
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
                <h2 className="text-2xl font-bold text-gray-800">我的订阅 ({subs.length})</h2>
                <button
                    onClick={openCreate}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-sm font-medium"
                >
                    + 新增订阅
                </button>
            </div>

            <div className="grid gap-5 grid-cols-1">
                {subs.map((sub, index) => {
                    const link = `${baseUrl}/api/s/${sub.token}`;
                    return (
                        <div
                            key={sub.token}
                            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative hover:shadow-md transition-all duration-200 group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-bold text-gray-800">
                                            {sub.name}
                                        </h3>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sub.enabled ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                            {sub.enabled ? '启用' : '禁用'}
                                        </span>
                                        {sub.groupId && sub.groupId !== 'default' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 border border-purple-200">Custom Group</span>}
                                        {sub.ruleId && sub.ruleId !== 'default' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200">Custom Rules</span>}
                                    </div>
                                    <p className="text-xs text-gray-400 font-mono mt-1 tracking-wide">Token: {sub.token}</p>
                                </div>
                                <div className="space-x-3">
                                    <button
                                        onClick={() => handleToggle(sub)}
                                        className={`text-sm hover:underline font-medium ${sub.enabled ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}
                                    >
                                        {sub.enabled ? '禁用' : '启用'}
                                    </button>
                                    <button onClick={() => openEdit(sub)} className="text-blue-600 text-sm hover:underline font-medium">编辑</button>
                                    <button onClick={() => handleDelete(sub.token)} className="text-red-500 text-sm hover:underline font-medium">删除</button>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between mb-4 group-hover:border-blue-100 transition-colors">
                                <code className="text-xs text-gray-600 break-all line-clamp-1 font-mono">{link}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(link);
                                        success('复制成功');
                                    }}
                                    className="ml-3 text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all shrink-0 font-medium"
                                >
                                    复制链接
                                </button>
                            </div>

                            {/* Upstream Sources Display */}
                            <div className="mb-4 text-xs text-gray-600">
                                <span className="font-semibold text-gray-500 mr-2">使用源:</span>
                                <div className="inline-flex flex-wrap gap-2 mt-1">
                                    {(sub.selectedSources && sub.selectedSources.length > 0) ? (
                                        sub.selectedSources.map(sourceName => {
                                            const source = availableSources.find(s => s.name === sourceName);
                                            if (!source) {
                                                return (
                                                    <span key={sourceName} className="px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-500 flex items-center gap-1">
                                                        🗑️ {sourceName} (已删除)
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
                                        availableSources.map(source => (
                                            <span key={source.name} className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${source.enabled !== false
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-gray-100 text-gray-500 border-gray-200 line-through decoration-gray-400'
                                                }`}>
                                                {source.enabled !== false ? '✅' : '⛔'} {source.name}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            {sub.customRules && (
                                <div className="text-xs text-gray-500">
                                    <span className="font-semibold text-gray-400">追加规则:</span> {sub.customRules.length > 50 ? sub.customRules.substring(0, 50) + '...' : sub.customRules}
                                </div>
                            )}
                        </div>
                    )
                })}
                {subs.length === 0 && (
                    <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm border border-dashed border-gray-200">
                        <p>暂无订阅</p>
                        <button onClick={openCreate} className="mt-2 text-blue-500 hover:underline text-sm">点击新增一个</button>
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingSub ? '编辑订阅' : '新增订阅'}
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
                                data.name,
                                data.customRules,
                                data.groupId,
                                data.ruleId,
                                data.selectedSources
                            );
                        }

                        if (result && result.error) {
                            error(result.error);
                            return;
                        }

                        success(editingSub ? '订阅更新成功' : '订阅创建成功');
                        closeModal();
                        refresh();
                    }}
                    onCancel={closeModal}
                    submitLabel={editingSub ? '保存' : '创建'}
                />
            </Modal>
        </div>
    );
}
