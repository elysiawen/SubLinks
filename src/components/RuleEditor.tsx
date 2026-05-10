'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/Modal';
import { parseRules, stringifyRules, genId } from '@/lib/rule-utils';

interface ProxyGroup {
    name: string;
    type: string;
    source: string;
}

interface RuleEditorProps {
    value: string; // The YAML content
    onChange: (value: string) => void;
    proxyGroups?: ProxyGroup[];
    availablePolicies?: string[]; // When provided, use this flat list instead of proxyGroups-based selector
    className?: string;
}

const RuleEditor = memo(function RuleEditor({ value, onChange, proxyGroups = [], availablePolicies, className }: RuleEditorProps) {
    const t = useTranslations('common.ruleEditor');

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

    // Helper functions (imported from @/lib/rule-utils)

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

    // Validate newRulePolicy when availablePolicies changes
    useEffect(() => {
        if (availablePolicies && !availablePolicies.includes(newRulePolicy)) {
            setNewRulePolicy('Proxy');
        }
    }, [availablePolicies, newRulePolicy]);

    const groupedPolicies = useMemo(() => {
        const grouped: Record<string, ProxyGroup[]> = {};

        // Add all proxy groups
        proxyGroups.filter(p => p.name.toLowerCase().includes(policySearch.toLowerCase())).forEach(p => {
            const source = p.source === 'custom' ? t('customGroups') : p.source;
            if (!grouped[source]) grouped[source] = [];
            grouped[source].push(p);
        });

        return grouped;
    }, [proxyGroups, policySearch, t]);

    const addGuiRule = () => {
        if (!newRuleValue.trim()) return;

        const newRule = {
            type: newRuleType,
            value: newRuleValue.trim(),
            policy: newRulePolicy,
            id: genId()
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
                <label className="block text-sm font-medium text-text-secondary">
                    {t('contentLabel')}
                </label>
                <div className="bg-muted p-0.5 rounded-lg flex text-xs">
                    <button
                        onClick={() => handleSwitchMode('simple')}
                        disabled={isSwitching}
                        className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'simple' ? 'bg-card text-accent-foreground shadow-sm font-medium' : 'text-text-tertiary'} ${isSwitching ? 'opacity-50' : ''}`}
                    >
                        {t('simpleMode')}
                    </button>
                    <button
                        onClick={() => handleSwitchMode('advanced')}
                        disabled={isSwitching}
                        className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'advanced' ? 'bg-card text-accent-foreground shadow-sm font-medium' : 'text-text-tertiary'} ${isSwitching ? 'opacity-50' : ''}`}
                    >
                        {t('advancedMode')}
                    </button>
                </div>
            </div>

            {isSwitching ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-quaternary border border-dashed border-border-strong rounded-lg animate-in fade-in duration-200">
                    <div className="w-6 h-6 border-2 border-blue-200 dark:border-blue-800 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-xs italic">{t('switching')}</span>
                </div>
            ) : ruleMode === 'advanced' ? (
                <div>
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-4 py-3 border border-border-input rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        rows={15}
                        placeholder={t('yamlPlaceholder')}
                    />
                    <p className="text-xs text-text-quaternary mt-1">
                        {t('yamlFormat')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Add Rule Form */}
                    <div className="border border-border-strong rounded-lg p-4 bg-muted">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={newRuleValue}
                                onChange={(e) => setNewRuleValue(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addGuiRule()}
                                placeholder={t('ruleValue')}
                                className="w-full sm:flex-1 sm:min-w-0 border border-border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent order-1 sm:order-2"
                            />

                            <div className="flex gap-2 w-full sm:w-auto order-2 sm:order-1 sm:contents">
                                <select
                                    value={newRuleType}
                                    onChange={(e) => setNewRuleType(e.target.value)}
                                    className="flex-1 sm:w-32 sm:flex-none border border-border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:order-1"
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
                                        placeholder={t('policy')}
                                        className="w-full border border-border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    {(proxyGroups.length > 0 || (availablePolicies && availablePolicies.length > 0)) && (
                                        <button
                                            onClick={() => {
                                                setPolicySearch('');
                                                setShowPolicySelector(true);
                                            }}
                                            className="absolute right-1 top-1 bottom-1 px-2 text-text-quaternary hover:text-blue-600 transition-colors"
                                        >
                                            🔍
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={addGuiRule}
                                    className="shrink-0 bg-accent-button text-white rounded-lg px-4 hover:bg-accent-button-hover transition-colors text-sm font-medium sm:order-4"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-text-quaternary group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                            placeholder={t('searchRulesPlaceholder')}
                            className="block w-full pl-9 pr-3 py-2 border border-border-strong rounded-lg bg-card placeholder-text-quaternary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        />
                    </div>

                    {/* Rules List */}
                    {isParsing ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-quaternary border border-dashed border-border-strong rounded-lg">
                            <div className="w-6 h-6 border-2 border-blue-200 dark:border-blue-800 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-xs italic">{t('parsingRules')}</span>
                        </div>
                    ) : filteredRules.length === 0 ? (
                        <div className="text-center text-text-quaternary text-sm py-8 border border-dashed border-border-input rounded-lg">
                            {ruleSearch ? t('noRulesMatch') : t('noRules')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="border border-border-strong rounded-lg divide-y divide-border max-h-96 overflow-y-auto">
                                {visibleRules.map((rule) => (
                                    <div key={rule.id} className="flex items-center justify-between p-3 hover:bg-muted">
                                        <div className="flex items-center gap-3 flex-1 font-mono text-sm">
                                            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold">
                                                {rule.type}
                                            </span>
                                            <span className="text-text-secondary break-all">{rule.value}</span>
                                            <span className="text-text-quaternary">→</span>
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
                                <p className="text-xs text-text-quaternary">
                                    {ruleSearch
                                        ? t('rulesCountSearch', { visible: visibleRules.length, filtered: filteredRules.length, total: guiRules.length })
                                        : t('rulesCount', { visible: visibleRules.length, filtered: filteredRules.length, total: guiRules.length })
                                    }
                                </p>
                                {visibleCount < filteredRules.length && (
                                    <button
                                        onClick={() => setVisibleCount(prev => prev + 200)}
                                        className="text-xs font-bold text-accent-foreground hover:text-accent-foreground/80 bg-accent px-3 py-1.5 rounded-lg transition"
                                    >
                                        {t('loadMore')}
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
                title={t('selectPolicy')}
                maxWidth="max-w-2xl"
                zIndex={60}
            >
                <div className="flex flex-col h-[60vh]">
                    <div className="border-b space-y-3 shrink-0 pb-4">
                        <input
                            type="text"
                            value={policySearch}
                            onChange={(e) => setPolicySearch(e.target.value)}
                            placeholder={t('searchPolicy')}
                            className="w-full border border-border-input rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 py-4 space-y-6">
                        {/* Built-in Policies */}
                        <div>
                            <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">{t('builtinPolicies')}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {['DIRECT', 'REJECT', 'REJECT-TINYGIF', 'NO-RESOLVE'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => {
                                            setNewRulePolicy(p);
                                            setShowPolicySelector(false);
                                        }}
                                        className="text-left px-3 py-2 rounded-lg border border-border-strong hover:border-blue-500 hover:bg-accent text-text-secondary transition-all text-sm font-medium"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Proxy Groups or Available Policies */}
                        {availablePolicies ? (
                            <div>
                                <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">{t('availablePolicies')}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {availablePolicies
                                        .filter(p => p.toLowerCase().includes(policySearch.toLowerCase()))
                                        .map(p => (
                                            <button
                                                key={p}
                                                onClick={() => {
                                                    setNewRulePolicy(p);
                                                    setShowPolicySelector(false);
                                                }}
                                                className="text-left px-3 py-2 rounded-lg border border-border-strong hover:border-blue-500 hover:bg-accent text-text-secondary transition-all text-sm font-medium"
                                            >
                                                {p}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        ) : (
                            Object.entries(groupedPolicies).map(([source, groups]) => {
                                const isCollapsed = collapsedSources.has(source);
                                return (
                                    <div key={source}>
                                        <button
                                            onClick={() => toggleSourceCollapse(source)}
                                            className="w-full flex items-center justify-between text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 hover:bg-muted p-1 rounded transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`transform transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                                    ▼
                                                </span>
                                                {source}
                                                <span className="bg-muted text-text-secondary px-1.5 py-0.5 rounded text-[10px]">{groups.length}</span>
                                            </div>
                                        </button>

                                        {!isCollapsed && (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-2 border-l-2 border-border ml-1">
                                                {groups.map(g => (
                                                    <button
                                                        key={`${g.source}-${g.name}`}
                                                        onClick={() => {
                                                            setNewRulePolicy(g.name);
                                                            setShowPolicySelector(false);
                                                        }}
                                                        className="text-left px-3 py-2 rounded-lg border border-border-strong hover:border-blue-500 hover:bg-accent text-text-secondary transition-all text-sm truncate"
                                                        title={g.name}
                                                    >
                                                        {g.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="pt-4 border-t border-border-strong">
                        <button
                            onClick={() => setShowPolicySelector(false)}
                            className="w-full px-4 py-2 bg-muted text-text-secondary rounded-lg hover:bg-border-strong transition-colors"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
});

export default RuleEditor;
