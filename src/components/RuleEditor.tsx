'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import Modal from '@/components/Modal';

interface ProxyGroup {
    name: string;
    type: string;
    source: string;
}

interface RuleEditorProps {
    value: string; // The YAML content
    onChange: (value: string) => void;
    proxyGroups?: ProxyGroup[];
    className?: string;
}

const RuleEditor = memo(function RuleEditor({ value, onChange, proxyGroups = [], className }: RuleEditorProps) {
    // Mode toggle
    const [ruleMode, setRuleMode] = useState<'simple' | 'advanced'>('simple');
    const [isSwitching, setIsSwitching] = useState(false);

    // Simple mode state
    const [guiRules, setGuiRules] = useState<{ type: string, value: string, policy: string, id: string }[]>([]);
    const [ruleSearch, setRuleSearch] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [visibleCount, setVisibleCount] = useState(100);
    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    // Policy Selector State
    const [showPolicySelector, setShowPolicySelector] = useState(false);
    const [policySearch, setPolicySearch] = useState('');
    const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());

    const toggleSourceCollapse = (source: string) => {
        const newCollapsed = new Set(collapsedSources);
        if (newCollapsed.has(source)) {
            newCollapsed.delete(source);
        } else {
            newCollapsed.add(source);
        }
        setCollapsedSources(newCollapsed);
    };

    // Helper functions
    const parseRules = (text: string) => {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.replace(/^-\s*/, '').split(',').map(p => p.trim());
                if (parts.length >= 3) {
                    return { type: parts[0], value: parts[1], policy: parts[2], id: Math.random().toString(36).substr(2, 9) };
                }
                return null;
            })
            .filter(r => r !== null) as { type: string, value: string, policy: string, id: string }[];
    };

    const stringifyRules = (rules: { type: string, value: string, policy: string }[]) => {
        return rules.map(r => `- ${r.type},${r.value},${r.policy}`).join('\n');
    };

    // Initialize GUI from text when component mounts or mode changes to simple
    useEffect(() => {
        if (ruleMode === 'simple' && value) {
            setIsParsing(true);
            // Use setTimeout to move parsing out of the main thread and allow UI to update (show loader)
            const timer = setTimeout(() => {
                const parsed = parseRules(value);
                setGuiRules(parsed);
                setIsParsing(false);
                setVisibleCount(100); // Reset visible count on parse
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [ruleMode, value]);

    const updateGuiRules = (newRules: typeof guiRules) => {
        setGuiRules(newRules);
        onChange(stringifyRules(newRules));
    };

    const groupedPolicies = useMemo(() => {
        const grouped: Record<string, ProxyGroup[]> = {};

        // Add all proxy groups
        proxyGroups.filter(p => p.name.toLowerCase().includes(policySearch.toLowerCase())).forEach(p => {
            const source = p.source === 'custom' ? '自定义组' : p.source;
            if (!grouped[source]) grouped[source] = [];
            grouped[source].push(p);
        });

        return grouped;
    }, [proxyGroups, policySearch]);

    const addGuiRule = () => {
        if (!newRuleValue.trim()) return;

        const newRule = {
            type: newRuleType,
            value: newRuleValue.trim(),
            policy: newRulePolicy,
            id: Math.random().toString(36).substr(2, 9)
        };
        updateGuiRules([...guiRules, newRule]);
        setNewRuleValue('');
    };

    const removeGuiRule = (id: string) => {
        updateGuiRules(guiRules.filter(r => r.id !== id));
    };

    const filteredRules = useMemo(() => {
        if (!ruleSearch) return guiRules;
        const lowSearch = ruleSearch.toLowerCase();
        return guiRules.filter(r =>
            r.type.toLowerCase().includes(lowSearch) ||
            r.value.toLowerCase().includes(lowSearch) ||
            r.policy.toLowerCase().includes(lowSearch)
        );
    }, [guiRules, ruleSearch]);

    const visibleRules = useMemo(() => {
        return filteredRules.slice(0, visibleCount);
    }, [filteredRules, visibleCount]);

    const handleSwitchMode = (mode: 'simple' | 'advanced') => {
        if (ruleMode === mode) return;
        setIsSwitching(true);
        // Delay switching to allow UI to render the loader first
        setTimeout(() => {
            setRuleMode(mode);
            setIsSwitching(false);
        }, 50);
    };

    return (
        <div className={className}>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                    规则内容
                </label>
                <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                    <button
                        onClick={() => handleSwitchMode('simple')}
                        disabled={isSwitching}
                        className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'} ${isSwitching ? 'opacity-50' : ''}`}
                    >
                        简易模式
                    </button>
                    <button
                        onClick={() => handleSwitchMode('advanced')}
                        disabled={isSwitching}
                        className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'advanced' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'} ${isSwitching ? 'opacity-50' : ''}`}
                    >
                        高级模式
                    </button>
                </div>
            </div>

            {isSwitching ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 border border-dashed border-gray-200 rounded-lg animate-in fade-in duration-200">
                    <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-xs italic">切换编辑器模式中...</span>
                </div>
            ) : ruleMode === 'advanced' ? (
                <div>
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        rows={15}
                        placeholder="- DOMAIN-SUFFIX,google.com,🚀 节点选择&#10;- DOMAIN-KEYWORD,youtube,🎬 YouTube&#10;- IP-CIDR,192.168.0.0/16,DIRECT&#10;- GEOIP,CN,DIRECT&#10;- MATCH,🚀 节点选择"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        YAML 格式，每行一条规则，格式: - TYPE,VALUE,POLICY
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Add Rule Form */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={newRuleValue}
                                onChange={(e) => setNewRuleValue(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addGuiRule()}
                                placeholder="规则值"
                                className="w-full sm:flex-1 sm:min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent order-1 sm:order-2"
                            />

                            <div className="flex gap-2 w-full sm:w-auto order-2 sm:order-1 sm:contents">
                                <select
                                    value={newRuleType}
                                    onChange={(e) => setNewRuleType(e.target.value)}
                                    className="flex-1 sm:w-32 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:order-1"
                                >
                                    <option value="DOMAIN">DOMAIN</option>
                                    <option value="DOMAIN-SUFFIX">DOMAIN-SUFFIX</option>
                                    <option value="DOMAIN-KEYWORD">DOMAIN-KEYWORD</option>
                                    <option value="IP-CIDR">IP-CIDR</option>
                                    <option value="IP-CIDR6">IP-CIDR6</option>
                                    <option value="GEOIP">GEOIP</option>
                                    <option value="MATCH">MATCH</option>
                                </select>

                                <div className="flex-1 sm:w-40 sm:flex-none relative sm:order-3">
                                    <input
                                        type="text"
                                        value={newRulePolicy}
                                        onChange={(e) => setNewRulePolicy(e.target.value)}
                                        placeholder="策略"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    {proxyGroups.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setPolicySearch('');
                                                setShowPolicySelector(true);
                                            }}
                                            className="absolute right-1 top-1 bottom-1 px-2 text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                            🔍
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={addGuiRule}
                                    className="shrink-0 bg-blue-600 text-white rounded-lg px-4 hover:bg-blue-700 transition-colors text-sm font-medium sm:order-4"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={ruleSearch}
                            onChange={(e) => {
                                setRuleSearch(e.target.value);
                                setVisibleCount(100);
                            }}
                            placeholder="搜索规则内容、策略名称..."
                            className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        />
                    </div>

                    {/* Rules List */}
                    {isParsing ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-xs italic">解析规则中...</span>
                        </div>
                    ) : filteredRules.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-8 border border-dashed border-gray-300 rounded-lg">
                            {ruleSearch ? '没有找到匹配的规则' : '暂无规则，请添加'}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                {visibleRules.map((rule) => (
                                    <div key={rule.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                        <div className="flex items-center gap-3 flex-1 font-mono text-sm">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                                                {rule.type}
                                            </span>
                                            <span className="text-gray-700 break-all">{rule.value}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="text-green-600 font-medium">{rule.policy}</span>
                                        </div>
                                        <button
                                            onClick={() => removeGuiRule(rule.id)}
                                            className="text-red-500 hover:text-red-700 text-sm px-2 shrink-0"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-400">
                                    展示 {visibleRules.length} / 共 {filteredRules.length} 条{ruleSearch && '结果'} (总 {guiRules.length}条)
                                </p>
                                {visibleCount < filteredRules.length && (
                                    <button
                                        onClick={() => setVisibleCount(prev => prev + 200)}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition"
                                    >
                                        加载更多 (+200)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Policy Selector Modal */}
            <Modal
                isOpen={showPolicySelector}
                onClose={() => setShowPolicySelector(false)}
                title="选择策略"
                maxWidth="max-w-2xl"
                zIndex={60}
            >
                <div className="flex flex-col h-[60vh]">
                    <div className="border-b space-y-3 shrink-0 pb-4">
                        <input
                            type="text"
                            value={policySearch}
                            onChange={(e) => setPolicySearch(e.target.value)}
                            placeholder="搜索策略..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 py-4 space-y-6">
                        {/* Built-in Policies */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">内置策略</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {['DIRECT', 'REJECT', 'REJECT-TINYGIF', 'NO-RESOLVE'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => {
                                            setNewRulePolicy(p);
                                            setShowPolicySelector(false);
                                        }}
                                        className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700 transition-all text-sm font-medium"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Proxy Groups */}
                        {Object.entries(groupedPolicies).map(([source, groups]) => {
                            const isCollapsed = collapsedSources.has(source);
                            return (
                                <div key={source}>
                                    <button
                                        onClick={() => toggleSourceCollapse(source)}
                                        className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:bg-gray-50 p-1 rounded transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`transform transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                                ▼
                                            </span>
                                            {source}
                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{groups.length}</span>
                                        </div>
                                    </button>

                                    {!isCollapsed && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-2 border-l-2 border-gray-100 ml-1">
                                            {groups.map(g => (
                                                <button
                                                    key={`${g.source}-${g.name}`}
                                                    onClick={() => {
                                                        setNewRulePolicy(g.name);
                                                        setShowPolicySelector(false);
                                                    }}
                                                    className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700 transition-all text-sm truncate"
                                                    title={g.name}
                                                >
                                                    {g.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <button
                            onClick={() => setShowPolicySelector(false)}
                            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
});

export default RuleEditor;
