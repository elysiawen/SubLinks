'use client';

import { useState, useMemo, useEffect } from 'react';
import { ConfigSet } from '@/lib/config-actions';
import yaml from 'js-yaml';
import { SubmitButton } from '@/components/SubmitButton';

export interface SubscriptionFormProps {
    initialData?: {
        name: string;
        remark?: string; // Admin uses remark, User uses name (which maps to remark). We align to 'name' for UI label but pass back mapped data.
        enabled: boolean;
        groupId: string;
        ruleId: string;
        customRules: string;
        selectedSources: string[];
    };
    configSets: {
        groups: ConfigSet[];
        rules: ConfigSet[];
    };
    defaultGroups?: string[];
    availableSources: {
        name: string;
        url: string;
        enabled?: boolean;
        status?: 'pending' | 'success' | 'failure';
        lastUpdated?: number
    }[];
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    isAdmin?: boolean;
    submitLabel?: string;
}

export default function SubscriptionForm({
    initialData,
    configSets,
    defaultGroups = [],
    availableSources = [],
    onSubmit,
    onCancel,
    isAdmin = false,
    submitLabel = '保存'
}: SubscriptionFormProps) {
    const [loading, setLoading] = useState(false);

    // Form State
    // User dashboard uses 'name' for remark field mapping. Admin uses 'remark'.
    // We will use 'name' as the form field name for consistency with User interface.
    const [name, setName] = useState(initialData?.name || initialData?.remark || '');
    const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

    const [groupId, setGroupId] = useState(initialData?.groupId || 'default');
    const [ruleId, setRuleId] = useState(initialData?.ruleId || 'default');
    const [customRules, setCustomRules] = useState(initialData?.customRules || '');
    // Default to all sources if creating new (and none selected), or use provided selection
    // Note: User dashboard default logic was: if creating, select all default sources.
    // We will handle defaults in parent or default here.
    const [selectedSources, setSelectedSources] = useState<string[]>(initialData?.selectedSources || []);

    // Set default sources if creating new and list is empty (User experience)
    useEffect(() => {
        if (!initialData && selectedSources.length === 0 && availableSources.length > 0) {
            // Default to selecting all enabled sources
            const enabledSources = availableSources
                .filter(s => s.enabled !== false)
                .map(s => s.name);
            setSelectedSources(enabledSources);
        }
    }, [initialData, availableSources]);

    const [showAdvanced, setShowAdvanced] = useState(false);

    // Rule Builder State
    const [ruleMode, setRuleMode] = useState<'simple' | 'advanced'>('simple');

    // GUI Rule Builder Logic
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

    const stringifyRules = (rules: { type: string, value: string, policy: string }[]) => {
        return rules.map(r => `${r.type},${r.value},${r.policy}`).join('\n');
    };

    const [guiRules, setGuiRules] = useState<{ type: string, value: string, policy: string, id: string }[]>([]);

    // Sync on mount/change
    useEffect(() => {
        if (ruleMode === 'simple') {
            setGuiRules(parseRules(customRules));
        }
    }, [customRules, ruleMode]);

    const updateGuiRules = (newRules: typeof guiRules) => {
        setGuiRules(newRules);
        setCustomRules(stringifyRules(newRules));
    };

    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    const RuleTypes = [
        'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'MATCH'
    ];

    // Calculate Dynamic Policies
    const availablePolicies = useMemo(() => {
        const basePolicies = ['Proxy', 'DIRECT', 'REJECT', 'Auto', 'Global'];
        let extraGroups: string[] = [];

        if (groupId === 'default') {
            extraGroups = defaultGroups;
        } else {
            const selectedSet = configSets.groups.find(g => g.id === groupId);
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
    }, [groupId, configSets.groups, defaultGroups]);

    // Validate policy
    useEffect(() => {
        if (!availablePolicies.includes(newRulePolicy)) {
            setNewRulePolicy('Proxy');
        }
    }, [availablePolicies, newRulePolicy]);

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

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await onSubmit({
                name, // Mapped to remark in Admin
                remark: name, // For compatibility
                enabled,
                groupId,
                ruleId,
                customRules,
                selectedSources
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">备注名称</label>
                <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="例如：iPhone, 家里软路由"
                />
            </div>

            {/* Upstream Source Selection */}
            {availableSources.length > 0 && (
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">选择上游源</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                        {availableSources.map(source => {
                            const isSelected = selectedSources.includes(source.name);
                            const isDisabled = source.enabled === false;

                            return (
                                <div
                                    key={source.name}
                                    onClick={() => {
                                        if (isDisabled) return;
                                        if (isSelected) {
                                            setSelectedSources(selectedSources.filter(s => s !== source.name));
                                        } else {
                                            setSelectedSources([...selectedSources, source.name]);
                                        }
                                    }}
                                    className={`
                                        relative flex items-center p-3 rounded-xl border transition-all cursor-pointer select-none group
                                        ${isDisabled
                                            ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed grayscale'
                                            : isSelected
                                                ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                        }
                                    `}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-medium text-sm truncate ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>{source.name}</span>
                                            {isDisabled && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-500 font-medium">已禁用</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`flex h-2 w-2 rounded-full ${source.status === 'success' ? 'bg-green-500' : source.status === 'failure' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                                            <span className="text-xs text-gray-500">
                                                {source.status === 'success' ? '正常' : source.status === 'failure' ? '失败' : '等待'}
                                            </span>
                                            {source.lastUpdated && source.lastUpdated > 0 && (
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(source.lastUpdated).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`
                                        w-5 h-5 rounded-full border flex items-center justify-center transition-colors ml-3 shrink-0
                                        ${isSelected
                                            ? 'bg-blue-500 border-blue-500 text-white'
                                            : 'border-gray-300 bg-white group-hover:border-blue-400'
                                        }
                                        ${isDisabled ? 'bg-gray-100 border-gray-200' : ''}
                                    `}>
                                        {isSelected && (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        选择要使用的上游节点源，未选择则默认使用全部可用源
                    </p>
                </div>
            )}

            {/* Admin: Explicit Enabled Toggle */}
            {isAdmin && (
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => setEnabled(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">启用订阅</span>
                    </label>
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
                                    value={groupId}
                                    onChange={e => setGroupId(e.target.value)}
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
                                    value={ruleId}
                                    onChange={e => setRuleId(e.target.value)}
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
                                            // Sync text to GUI is handled by useEffect when mode changes, 
                                            // but we want to make sure customRules state is current source of truth
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
                                        value={customRules}
                                        onChange={e => setCustomRules(e.target.value)}
                                        placeholder={`- DOMAIN-SUFFIX,google.com,Proxy`}
                                    />
                                    <div className="absolute bottom-2 right-3 text-[10px] text-gray-400 pointer-events-none bg-white/80 px-1 rounded">
                                        Raw Edit Mode
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                    <div className="p-3 bg-white border-b border-gray-100 space-y-2">
                                        {/* Domain/Value Input - Full width on mobile */}
                                        <input
                                            className="w-full text-xs border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500"
                                            placeholder={newRuleType === 'MATCH' ? '无需填写' : 'google.com'}
                                            value={newRuleValue}
                                            onChange={e => setNewRuleValue(e.target.value)}
                                            disabled={newRuleType === 'MATCH'}
                                        />

                                        {/* Type, Policy, Add Button - Row that fits */}
                                        <div className="flex gap-2 items-center">
                                            <select
                                                className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-2 outline-none focus:border-blue-500"
                                                value={newRuleType}
                                                onChange={e => setNewRuleType(e.target.value)}
                                            >
                                                {RuleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>

                                            <select
                                                className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-2 outline-none focus:border-blue-500"
                                                value={newRulePolicy}
                                                onChange={e => setNewRulePolicy(e.target.value)}
                                            >
                                                {availablePolicies.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>

                                            <button
                                                type="button"
                                                onClick={addRule}
                                                className="shrink-0 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
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
                    onClick={onCancel}
                    className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 border border-gray-200"
                >
                    取消
                </button>
                <SubmitButton
                    onClick={handleSubmit}
                    isLoading={loading}
                    text={submitLabel}
                    className="flex-1 px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/20"
                />
            </div>
        </div>
    );
}
