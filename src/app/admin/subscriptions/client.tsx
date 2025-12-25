'use client';

import { useState, useMemo, useEffect } from 'react';
import { updateAdminSubscription, deleteAdminSubscription, refreshSubscriptionCache, refreshAllSubscriptionCaches } from './actions';
import { ConfigSet } from '@/lib/config-actions';
import yaml from 'js-yaml';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import Modal from '@/components/Modal';

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
}

interface ConfigSets {
    groups: ConfigSet[];
    rules: ConfigSet[];
}

export default function AdminSubsClient({
    initialSubs,
    configSets,
    defaultGroups,
    availableSources
}: {
    initialSubs: Sub[],
    configSets: ConfigSets,
    defaultGroups: string[],
    availableSources: { name: string; url: string }[]
}) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [subs, setSubs] = useState<Sub[]>(initialSubs);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [formRemark, setFormRemark] = useState('');
    const [formEnabled, setFormEnabled] = useState(true);
    const [formGroupId, setFormGroupId] = useState('default');
    const [formRuleId, setFormRuleId] = useState('default');
    const [formCustomRules, setFormCustomRules] = useState('');
    const [formSelectedSources, setFormSelectedSources] = useState<string[]>([]);

    // Rule Builder State
    const [ruleMode, setRuleMode] = useState<'simple' | 'advanced'>('simple');
    const [guiRules, setGuiRules] = useState<{ type: string, value: string, policy: string, id: string }[]>([]);
    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    // Calculate Dynamic Policies based on selected Group Config
    // Reused logic from DashboardClient for consistency
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

    // Reset newRulePolicy if it's no longer valid
    useEffect(() => {
        if (!availablePolicies.includes(newRulePolicy)) {
            setNewRulePolicy('Proxy');
        }
    }, [availablePolicies, newRulePolicy]);

    // Helper to parse rules from text
    const parseRules = (text: string) => {
        if (!text) return [];
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

    // Sync Text to GUI
    const syncTextToGui = (text: string) => {
        setGuiRules(parseRules(text));
    };

    // Sync GUI to Text
    const updateGuiRules = (newRules: typeof guiRules) => {
        setGuiRules(newRules);
        setFormCustomRules(stringifyRules(newRules));
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

    const refresh = () => {
        window.location.reload();
    };

    const handleEdit = (sub: Sub) => {
        setEditingSub(sub);
        setFormRemark(sub.remark);
        setFormEnabled(sub.enabled);
        setFormGroupId(sub.groupId || 'default');
        setFormRuleId(sub.ruleId || 'default');
        setFormCustomRules(sub.customRules);
        setFormSelectedSources(sub.selectedSources || availableSources.map(s => s.name));

        // Initialize GUI state
        syncTextToGui(sub.customRules);
        setRuleMode('simple');
    };

    const handleSave = async () => {
        if (!editingSub) return;
        setLoading(true);
        await updateAdminSubscription(editingSub.token, {
            remark: formRemark,
            enabled: formEnabled,
            groupId: formGroupId,
            ruleId: formRuleId,
            customRules: formCustomRules,
            selectedSources: formSelectedSources
        });
        setLoading(false);
        setEditingSub(null);
        success('订阅更新成功');
        refresh();
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
                <h1 className="text-2xl font-bold text-gray-800">所有订阅管理</h1>
                <button
                    onClick={async () => {
                        if (await confirm('确定要刷新所有订阅的缓存吗？这可能会增加服务器负载。')) {
                            const res = await refreshAllSubscriptionCaches();
                            if (res?.error) {
                                error(res.error);
                            } else {
                                success('所有订阅缓存已清除');
                            }
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200"
                >
                    <span>🔄</span>
                    刷新所有订阅缓存
                </button>
            </div>

            {subs.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无任何订阅数据
                </div>
            ) : (
                <>
                    {/* Desktop View: Table */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-900 font-medium">
                                    <tr>
                                        <th className="px-6 py-4 whitespace-nowrap">用户</th>
                                        <th className="px-6 py-4 whitespace-nowrap">备注名称</th>
                                        <th className="px-6 py-4 whitespace-nowrap">Token</th>
                                        <th className="px-6 py-4 whitespace-nowrap">状态</th>
                                        <th className="px-6 py-4 whitespace-nowrap">配置</th>
                                        <th className="px-6 py-4 whitespace-nowrap">创建时间</th>
                                        <th className="px-6 py-4 whitespace-nowrap text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {subs.map((sub) => (
                                        <tr key={sub.token} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{sub.username}</td>
                                            <td className="px-6 py-4 whitespace-nowrap max-w-[200px] truncate" title={sub.remark}>{sub.remark}</td>
                                            <td className="px-6 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">{sub.token.substring(0, 8)}...</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${sub.enabled ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                                    {sub.enabled ? '启用' : '禁用'}
                                                </span>
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
                                                        if (await confirm('确定要刷新此订阅的缓存吗？')) {
                                                            const res = await refreshSubscriptionCache(sub.token);
                                                            if (res?.error) {
                                                                error(res.error);
                                                            } else {
                                                                success('缓存已清除');
                                                            }
                                                        }
                                                    }}
                                                    className="text-green-600 hover:text-green-800 font-medium"
                                                    title="清除此订阅的缓存"
                                                >
                                                    刷新
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
                                                if (await confirm('确定要刷新此订阅的缓存吗？')) {
                                                    const res = await refreshSubscriptionCache(sub.token);
                                                    if (res?.error) error(res.error);
                                                    else success('缓存已清除');
                                                }
                                            }}
                                            className="text-green-600 hover:text-green-800"
                                        >
                                            刷新
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
            )}

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingSub}
                onClose={() => setEditingSub(null)}
                title={`编辑订阅 - ${editingSub?.username}`}
            >
                {editingSub && (
                    <>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">备注名称</label>
                                <input
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={formRemark}
                                    onChange={e => setFormRemark(e.target.value)}
                                />
                            </div>

                            {/* Upstream Source Selection */}
                            {availableSources.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">选择上游源</label>
                                    <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto bg-gray-50">
                                        {availableSources.map(source => (
                                            <label key={source.name} className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors">
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
                                    <p className="text-xs text-gray-400 mt-1">至少选择一个上游源</p>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <label className="block text-sm font-medium text-gray-700">状态:</label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formEnabled}
                                        onChange={e => setFormEnabled(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm">启用订阅</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">策略组</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                        value={formGroupId}
                                        onChange={e => setFormGroupId(e.target.value)}
                                    >
                                        <option value="default">默认</option>
                                        {configSets.groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">分流规则</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                        value={formRuleId}
                                        onChange={e => setFormRuleId(e.target.value)}
                                    >
                                        <option value="default">默认</option>
                                        {configSets.rules.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">自定义规则</label>
                                    <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                        <button
                                            onClick={() => {
                                                setRuleMode('simple');
                                                syncTextToGui(formCustomRules);
                                            }}
                                            className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}
                                        >
                                            简易模式
                                        </button>
                                        <button
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
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 h-48 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                            value={formCustomRules}
                                            onChange={e => setFormCustomRules(e.target.value)}
                                            placeholder="每行一条规则..."
                                        />
                                        <div className="absolute bottom-2 right-3 text-[10px] text-gray-400 pointer-events-none bg-white/80 px-1 rounded">
                                            Raw Edit Mode
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                        {/* Add Form */}
                                        <div className="p-3 bg-white border-b border-gray-100 flex gap-2 items-center">
                                            <select
                                                className="w-32 shrink-0 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                                                value={newRuleType}
                                                onChange={e => setNewRuleType(e.target.value)}
                                            >
                                                {RuleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>

                                            <input
                                                className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-blue-500"
                                                placeholder={newRuleType === 'MATCH' ? '无需填写' : 'google.com'}
                                                value={newRuleValue}
                                                onChange={e => setNewRuleValue(e.target.value)}
                                                disabled={newRuleType === 'MATCH'}
                                            />

                                            <select
                                                className="w-28 shrink-0 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                                                value={newRulePolicy}
                                                onChange={e => setNewRulePolicy(e.target.value)}
                                            >
                                                {availablePolicies.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>

                                            <button
                                                onClick={addRule}
                                                className="shrink-0 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Rule List */}
                                        <div className="h-40 overflow-y-auto p-2 space-y-2">
                                            {guiRules.map((rule, idx) => (
                                                <div key={rule.id} className="flex items-center justify-between text-xs bg-white p-2 rounded shadow-sm border border-gray-100 group">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <span className="font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{rule.type}</span>
                                                        <span className="font-mono text-gray-700 truncate">{rule.value || '*'}</span>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="text-blue-600 font-medium">{rule.policy}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => removeRule(rule.id)}
                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                            {guiRules.length === 0 && (
                                                <div className="text-center text-gray-400 text-xs py-8 italic">
                                                    暂无规则
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingSub(null)}
                                className="px-4 py-2 text-sm text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100"
                            >
                                取消
                            </button>
                            <SubmitButton
                                onClick={handleSave}
                                isLoading={loading}
                                text="保存更改"
                            />
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}
