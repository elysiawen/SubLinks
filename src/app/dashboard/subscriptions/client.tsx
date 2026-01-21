'use client';

import { useState, useMemo, useEffect } from 'react';
import { createSubscription, deleteSubscription, updateSubscription } from '@/lib/sub-actions';
import { ConfigSet } from '@/lib/config-actions';
import yaml from 'js-yaml';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import { getGroupSets, getRuleSets, getProxyGroups, getUpstreamSources } from '@/lib/config-actions';
import Modal from '@/components/Modal';

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

export default function SubscriptionsClient({ initialSubs, username, baseUrl, configSets: initialConfigSets, defaultGroups: initialDefaultGroups = [], availableSources: initialAvailableSources = [] }: { initialSubs: Sub[], username: string, baseUrl: string, configSets?: ConfigSets, defaultGroups?: string[], availableSources?: { name: string; url: string; isDefault?: boolean }[] }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [subs, setSubs] = useState<Sub[]>(initialSubs);

    // Data State
    const [configSets, setConfigSets] = useState<{ groups: ConfigSet[], rules: ConfigSet[] }>(initialConfigSets || { groups: [], rules: [] });
    const [defaultGroups, setDefaultGroups] = useState<string[]>(initialDefaultGroups || []);
    const [availableSources, setAvailableSources] = useState<{ name: string; url: string; isDefault?: boolean }[]>(initialAvailableSources || []);
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
                    .map(g => g.name);
                setDefaultGroups(defaults);

                setAvailableSources(sources);
                setDataLoaded(true);
            }).catch(e => {
                console.error("Failed to load dashboard data", e);
                error("加载配置数据失败，部分功能可能不可用");
            });
        }
    }, [dataLoaded, error]);

    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);

    // Form State
    const [formName, setFormName] = useState('');
    const [formRules, setFormRules] = useState('');
    const [formGroupId, setFormGroupId] = useState('default');
    const [formRuleId, setFormRuleId] = useState('default');
    const [formSelectedSources, setFormSelectedSources] = useState<string[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Calculate Dynamic Policies based on selected Group Config
    const availablePolicies = useMemo(() => {
        const basePolicies = ['Proxy', 'DIRECT', 'REJECT', 'Auto', 'Global'];
        let extraGroups: string[] = [];

        if (formGroupId === 'default') {
            extraGroups = defaultGroups;
        } else {
            const selectedSet = configSets.groups.find(g => g.id === formGroupId);
            if (selectedSet) {
                try {
                    const doc = yaml.load(selectedSet.content) as any;
                    if (Array.isArray(doc)) {
                        extraGroups = doc.map((g: any) => g.name);
                    } else if (doc && typeof doc === 'object') {
                        if (doc['proxy-groups'] && Array.isArray(doc['proxy-groups'])) {
                            extraGroups = doc['proxy-groups'].map((g: any) => g.name);
                        } else if (doc.name) {
                            extraGroups = [doc.name];
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse custom group set:', e);
                }
            }
        }

        const all = [...basePolicies, ...extraGroups];
        return Array.from(new Set(all));
    }, [formGroupId, configSets.groups, defaultGroups]);

    const refresh = async () => {
        window.location.reload();
    };

    const handleSubmit = async () => {
        setLoading(true);
        let result;
        if (editingSub) {
            result = await updateSubscription(editingSub.token, formName, formRules, formGroupId, formRuleId, formSelectedSources);
        } else {
            result = await createSubscription(formName, formRules, formGroupId, formRuleId, formSelectedSources);
        }
        setLoading(false);

        if (result && result.error) {
            error(result.error);
            return;
        }

        success(editingSub ? '订阅更新成功' : '订阅创建成功');
        closeModal();
        refresh();
    };

    const handleDelete = async (token: string) => {
        if (await confirm('确定删除此订阅?', { confirmColor: 'red', confirmText: '彻底删除' })) {
            await deleteSubscription(token);
            success('订阅已删除');
            refresh();
        }
    }

    // Rule Builder State
    const [ruleMode, setRuleMode] = useState<'simple' | 'advanced'>('simple');

    // Helper to parse rules from text
    const parseRules = (text: string) => {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 3) {
                    return { type: parts[0], value: parts[1], policy: parts[2], id: Math.random().toString(36).substr(2, 9) };
                }
                return null;
            })
            .filter(r => r !== null) as { type: string, value: string, policy: string, id: string }[];
    };

    // Helper to stringify rules
    const stringifyRules = (rules: { type: string, value: string, policy: string }[]) => {
        return rules.map(r => `${r.type},${r.value},${r.policy}`).join('\n');
    };

    // GUI State
    const [guiRules, setGuiRules] = useState<{ type: string, value: string, policy: string, id: string }[]>([]);
    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    // Reset newRulePolicy if it's no longer valid when groups change
    useEffect(() => {
        if (!availablePolicies.includes(newRulePolicy)) {
            setNewRulePolicy('Proxy');
        }
    }, [availablePolicies, newRulePolicy]);

    // Sync Text to GUI when opening modal or switching modes
    const syncTextToGui = (text: string) => {
        setGuiRules(parseRules(text));
    };

    // Sync GUI to Text when changing rules
    const updateGuiRules = (newRules: typeof guiRules) => {
        setGuiRules(newRules);
        setFormRules(stringifyRules(newRules));
    };

    const addRule = () => {
        if (!newRuleValue && newRuleType !== 'MATCH') return;
        const newRule = { type: newRuleType, value: newRuleValue, policy: newRulePolicy, id: Math.random().toString(36).substr(2, 9) };
        const updated = [...guiRules, newRule];
        updateGuiRules(updated);
        setNewRuleValue('');
    };

    const removeRule = (id: string) => {
        const updated = guiRules.filter(r => r.id !== id);
        updateGuiRules(updated);
    };

    const RuleTypes = [
        'DOMAIN-SUFFIX',
        'DOMAIN-KEYWORD',
        'DOMAIN',
        'IP-CIDR',
        'IP-CIDR6',
        'GEOIP',
        'MATCH'
    ];

    const openCreate = () => {
        setEditingSub(null);
        setFormName('');
        setFormRules('');
        setFormGroupId('default');
        setFormRuleId('default');
        setFormSelectedSources(availableSources.filter(s => s.isDefault).map(s => s.name));
        setRuleMode('simple');
        setGuiRules([]);
        setIsModalOpen(true);
    }

    const openEdit = (sub: Sub) => {
        setEditingSub(sub);
        setFormName(sub.name);
        setFormRules(sub.customRules);
        setFormGroupId(sub.groupId || 'default');
        setFormRuleId(sub.ruleId || 'default');
        setFormSelectedSources(sub.selectedSources || availableSources.map(s => s.name));
        setRuleMode('simple');
        syncTextToGui(sub.customRules);
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
            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingSub ? '编辑订阅' : '新增订阅'}
                maxWidth="max-w-lg"
            >
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">备注名称</label>
                        <input
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            placeholder="例如：iPhone, 家里软路由"
                        />
                    </div>

                    {/* Upstream Source Selection */}
                    {availableSources.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">选择上游源</label>
                            <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto bg-gray-50">
                                {availableSources.map(source => (
                                    <label key={source.name} className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={formSelectedSources.includes(source.name)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFormSelectedSources([...formSelectedSources, source.name]);
                                                } else {
                                                    setFormSelectedSources(formSelectedSources.filter(s => s !== source.name));
                                                }
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{source.name}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">选择要使用的上游节点源,未选择则使用全部</p>
                        </div>
                    )}

                    {/* Advanced Settings - Collapsible */}
                    <div className="border-t border-gray-200 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-700">⚙️ 高级配置</span>
                                <span className="text-xs text-gray-500">(策略组、规则、自定义规则)</span>
                            </div>
                            <svg
                                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''
                                    }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showAdvanced && (
                            <div className="mt-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">策略组配置</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                                            value={formGroupId}
                                            onChange={e => setFormGroupId(e.target.value)}
                                        >
                                            <option value="default">默认 (跟随上游)</option>
                                            {configSets.groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">分流规则配置</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                                            value={formRuleId}
                                            onChange={e => setFormRuleId(e.target.value)}
                                        >
                                            <option value="default">默认 (跟随上游)</option>
                                            {configSets.rules.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-semibold text-gray-700">追加自定义规则</label>
                                        <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRuleMode('simple');
                                                    syncTextToGui(formRules);
                                                }}
                                                className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}
                                            >
                                                简易模式
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRuleMode('advanced')}
                                                className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'advanced' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}
                                            >
                                                高级模式
                                            </button>
                                        </div>
                                    </div>

                                    {ruleMode === 'advanced' ? (
                                        <div className="relative">
                                            <textarea
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 font-mono text-xs h-48 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                                                value={formRules}
                                                onChange={e => setFormRules(e.target.value)}
                                                placeholder={`- DOMAIN-SUFFIX,google.com,Proxy`}
                                            />
                                            <div className="absolute bottom-2 right-3 text-[10px] text-gray-400 pointer-events-none bg-white/80 px-1 rounded">
                                                Raw Edit Mode
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                            <div className="p-3 bg-white border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-center">
                                                <input
                                                    className="w-full sm:flex-1 sm:min-w-0 text-xs border border-gray-200 rounded px-3 py-2 sm:py-1.5 outline-none focus:border-blue-500 order-1 sm:order-2"
                                                    placeholder={newRuleType === 'MATCH' ? '无需填写' : 'google.com'}
                                                    value={newRuleValue}
                                                    onChange={e => setNewRuleValue(e.target.value)}
                                                    disabled={newRuleType === 'MATCH'}
                                                />

                                                <div className="flex gap-2 w-full sm:w-auto order-2 sm:order-1 sm:contents">
                                                    <select
                                                        className="flex-1 sm:w-32 sm:flex-none text-xs border border-gray-200 rounded px-2 py-2 sm:py-1.5 outline-none focus:border-blue-500"
                                                        value={newRuleType}
                                                        onChange={e => setNewRuleType(e.target.value)}
                                                    >
                                                        {RuleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>

                                                    <select
                                                        className="flex-1 sm:w-28 sm:flex-none text-xs border border-gray-200 rounded px-2 py-2 sm:py-1.5 outline-none focus:border-blue-500 sm:order-3"
                                                        value={newRulePolicy}
                                                        onChange={e => setNewRulePolicy(e.target.value)}
                                                    >
                                                        {availablePolicies.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>

                                                    <button
                                                        type="button"
                                                        onClick={addRule}
                                                        className="shrink-0 bg-blue-600 text-white px-3 sm:px-2 py-2 sm:py-1.5 rounded hover:bg-blue-700 sm:order-4"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="h-40 overflow-y-auto p-2 space-y-2">
                                                {guiRules.map((rule) => (
                                                    <div key={rule.id} className="flex items-center justify-between text-xs bg-white p-2 rounded shadow-sm border border-gray-100 group">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <span className="font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{rule.type}</span>
                                                            <span className="font-mono text-gray-700 truncate">{rule.value || '*'}</span>
                                                            <span className="text-gray-300">→</span>
                                                            <span className="text-blue-600 font-medium">{rule.policy}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRule(rule.id)}
                                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                                {guiRules.length === 0 && (
                                                    <div className="text-center text-gray-400 text-xs py-8 italic">
                                                        添加几条自定义规则...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 border border-gray-200"
                        >
                            取消
                        </button>
                        <SubmitButton
                            onClick={handleSubmit}
                            isLoading={loading}
                            text="保存"
                            className="flex-1 px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/20"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
