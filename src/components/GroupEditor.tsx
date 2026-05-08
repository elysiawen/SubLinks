'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/Modal';
import { genId } from '@/lib/rule-utils';

interface ProxyItem {
    id: string;
    name: string;
    type: string;
    source: string;
}

interface GroupEditorProps {
    value: string; // The YAML content
    onChange: (value: string) => void;
    proxies: Array<ProxyItem>;
    className?: string;
}

const GroupEditor = memo(function GroupEditor({ value, onChange, proxies, className }: GroupEditorProps) {
    const t = useTranslations('common.groupEditor');

    // Group Builder State
    const [groupMode, setGroupMode] = useState<'simple' | 'advanced'>('simple');
    const [isSwitching, setIsSwitching] = useState(false);
    const [guiGroups, setGuiGroups] = useState<{ name: string, type: string, proxies: string[], id: string }[]>([]);
    const [groupSearch, setGroupSearch] = useState('');

    // Form State
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState('select');

    // Proxy Selector State
    const [showProxySelector, setShowProxySelector] = useState(false);
    const [selectorGroupId, setSelectorGroupId] = useState<string | null>(null);
    const [proxySearch, setProxySearch] = useState('');
    const [selectedProxies, setSelectedProxies] = useState<string[]>([]);
    const [collapsedSources, setCollapsedSources] = useState<string[]>([]);

    // Dynamic Filter State
    const [dynamicFilterType, setDynamicFilterType] = useState('KEYWORD');
    const [dynamicFilterValue, setDynamicFilterValue] = useState('');

    // Helper functions
    const parseGroups = (text: string) => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const result: { name: string, type: string, proxies: string[], id: string }[] = [];
        let currentGroup: any = null;

        for (const line of lines) {
            if (line.startsWith('- name:')) {
                if (currentGroup) result.push(currentGroup);
                currentGroup = {
                    name: line.replace('- name:', '').trim(),
                    type: 'select',
                    proxies: [],
                    id: genId()
                };
            } else if (line.startsWith('type:') && currentGroup) {
                currentGroup.type = line.replace('type:', '').trim();
            } else if (line.startsWith('- ') && currentGroup && !line.startsWith('- name:')) {
                currentGroup.proxies.push(line.replace('- ', '').trim());
            }
        }
        if (currentGroup) result.push(currentGroup);
        return result;
    };

    const stringifyGroups = (groups: { name: string, type: string, proxies: string[] }[]) => {
        return groups.map(g => {
            const proxies = g.proxies.map(p => `    - ${p}`).join('\n');
            return `- name: ${g.name}\n  type: ${g.type}\n  proxies:\n${proxies}`;
        }).join('\n');
    };

    // Initialize GUI from text when component mounts or mode changes to simple
    useEffect(() => {
        if (groupMode === 'simple' && value) {
            setGuiGroups(parseGroups(value));
        }
    }, [groupMode, value]);

    const syncTextToGui = () => {
        setGuiGroups(parseGroups(value));
    };

    const updateGuiGroups = (newRules: typeof guiGroups) => {
        setGuiGroups(newRules);
        onChange(stringifyGroups(newRules));
    };

    const handleSwitchMode = (mode: 'simple' | 'advanced') => {
        if (groupMode === mode) return;
        setIsSwitching(true);
        setTimeout(() => {
            setGroupMode(mode);
            setIsSwitching(false);
        }, 50);
    };

    // Group logic
    const addGuiGroup = () => {
        if (!newGroupName.trim()) return;

        const newGroup = {
            name: newGroupName.trim(),
            type: newGroupType,
            proxies: [],
            id: genId()
        };
        updateGuiGroups([...guiGroups, newGroup]);
        setNewGroupName('');
        setNewGroupType('select');
    };

    const removeGuiGroup = (id: string) => {
        updateGuiGroups(guiGroups.filter(g => g.id !== id));
    };

    const removeProxyFromGroup = (groupId: string, proxyIndex: number) => {
        const updatedGroups = guiGroups.map(g => {
            if (g.id === groupId) {
                return { ...g, proxies: g.proxies.filter((_, i) => i !== proxyIndex) };
            }
            return g;
        });
        updateGuiGroups(updatedGroups);
    };

    // Proxy Selector Logic
    const openProxySelector = (groupId: string) => {
        setSelectorGroupId(groupId);
        setProxySearch('');
        setSelectedProxies([]);
        setCollapsedSources([]);
        setShowProxySelector(true);
    };

    const toggleProxySelection = (proxyName: string) => {
        setSelectedProxies(prev =>
            prev.includes(proxyName)
                ? prev.filter(p => p !== proxyName)
                : [...prev, proxyName]
        );
    };

    const addSelectedProxies = () => {
        if (!selectorGroupId || selectedProxies.length === 0) return;

        const updatedGroups = guiGroups.map(g => {
            if (g.id === selectorGroupId) {
                const newProxies = [...g.proxies];
                selectedProxies.forEach(p => {
                    if (!newProxies.includes(p)) newProxies.push(p);
                });
                return { ...g, proxies: newProxies };
            }
            return g;
        });

        updateGuiGroups(updatedGroups);
        setShowProxySelector(false);
        setSelectedProxies([]);
    };

    const toggleSourceCollapse = (source: string) => {
        setCollapsedSources(prev =>
            prev.includes(source)
                ? prev.filter(s => s !== source)
                : [...prev, source]
        );
    };

    const filteredGroups = useMemo(() => {
        if (!groupSearch) return guiGroups;
        const lowSearch = groupSearch.toLowerCase();
        return guiGroups.filter(g =>
            g.name.toLowerCase().includes(lowSearch) ||
            g.type.toLowerCase().includes(lowSearch)
        );
    }, [guiGroups, groupSearch]);

    const groupedProxies = useMemo(() => {
        const grouped: Record<string, typeof proxies> = {};
        proxies.filter(p => p.name.toLowerCase().includes(proxySearch.toLowerCase())).forEach(p => {
            if (!grouped[p.source]) grouped[p.source] = [];
            grouped[p.source].push(p);
        });
        return grouped;
    }, [proxies, proxySearch]);

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
                        className={`px-3 py-1 rounded-md transition-all ${groupMode === 'simple' ? 'bg-card text-accent-foreground shadow-sm font-medium' : 'text-text-tertiary'} ${isSwitching ? 'opacity-50' : ''}`}
                    >
                        {t('simpleMode')}
                    </button>
                    <button
                        onClick={() => handleSwitchMode('advanced')}
                        disabled={isSwitching}
                        className={`px-3 py-1 rounded-md transition-all ${groupMode === 'advanced' ? 'bg-card text-accent-foreground shadow-sm font-medium' : 'text-text-tertiary'} ${isSwitching ? 'opacity-50' : ''}`}
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
            ) : groupMode === 'advanced' ? (
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
                    {/* Add Group Form */}
                    <div className="border border-border-strong rounded-lg p-4 bg-muted">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addGuiGroup()}
                                placeholder={t('groupNamePlaceholder')}
                                className="w-full sm:flex-1 sm:min-w-0 border border-border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent order-1 sm:order-1"
                            />
                            <div className="flex gap-2 w-full sm:w-auto order-2 sm:order-2">
                                <select
                                    value={newGroupType}
                                    onChange={(e) => setNewGroupType(e.target.value)}
                                    className="flex-1 sm:w-32 border border-border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="select">select</option>
                                    <option value="url-test">url-test</option>
                                    <option value="fallback">fallback</option>
                                    <option value="load-balance">load-balance</option>
                                </select>
                                <button
                                    onClick={addGuiGroup}
                                    className="shrink-0 bg-blue-600 text-white rounded-lg px-4 hover:bg-blue-700 transition-colors text-sm font-medium"
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
                            value={groupSearch}
                            onChange={(e) => setGroupSearch(e.target.value)}
                            placeholder={t('searchGroupsPlaceholder')}
                            className="block w-full pl-9 pr-3 py-2 border border-border-strong rounded-lg bg-card placeholder-text-quaternary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        />
                    </div>

                    {/* Groups List */}
                    {filteredGroups.length === 0 ? (
                        <div className="text-center text-text-quaternary text-sm py-8 border border-dashed border-border-input rounded-lg">
                            {groupSearch ? t('noGroupsMatch') : t('noGroups')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredGroups.map((group) => (
                                <div key={group.id} className="border border-border-strong rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-text-primary">{group.name}</span>
                                            <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 rounded text-xs">
                                                {group.type}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeGuiGroup(group.id)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            {t('deleteGroup')}
                                        </button>
                                    </div>

                                    {/* Proxies */}
                                    <div className="space-y-2">
                                        {group.proxies.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {group.proxies.map((proxy, idx) => {
                                                    let badgeClass = 'bg-accent text-accent-foreground border border-blue-200 dark:border-blue-800';
                                                    let displayText = proxy;

                                                    if (proxy.startsWith('SOURCE:')) {
                                                        badgeClass = 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
                                                        displayText = `📚 ${t('fullSource')}: ${proxy.substring(7)}`;
                                                    } else if (proxy.startsWith('KEYWORD:')) {
                                                        badgeClass = 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                                                        displayText = `🔍 ${t('contains')}: ${proxy.substring(8)}`;
                                                    } else if (proxy.startsWith('REGEX:')) {
                                                        badgeClass = 'bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800';
                                                        displayText = `🔡 ${t('regexLabel')}: ${proxy.substring(6)}`;
                                                    }

                                                    return (
                                                        <span
                                                            key={idx}
                                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${badgeClass}`}
                                                        >
                                                            {displayText}
                                                            <button
                                                                onClick={() => removeProxyFromGroup(group.id, idx)}
                                                                className="hover:text-red-600 ml-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => openProxySelector(group.id)}
                                            className="w-full py-1.5 border border-dashed border-border-input rounded-lg text-text-tertiary hover:border-blue-500 hover:text-blue-500 text-sm transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span>{t('addNode')}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-text-quaternary">
                        {t('groupCount', { count: guiGroups.length })}
                    </p>
                </div>
            )}

            {/* Proxy Selector Modal */}
            <Modal
                isOpen={showProxySelector}
                onClose={() => setShowProxySelector(false)}
                title={t('selectNodes')}
                maxWidth="max-w-2xl"
                zIndex={60}
            >
                <div className="flex flex-col h-[65vh]">
                    <div className="border-b border-border space-y-4 shrink-0 pb-4 px-1">
                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-text-quaternary group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={proxySearch}
                                onChange={(e) => setProxySearch(e.target.value)}
                                placeholder={t('searchNodes')}
                                className="block w-full pl-10 pr-3 py-2.5 border border-border-strong rounded-xl leading-5 bg-muted placeholder-text-quaternary focus:outline-none focus:bg-card focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                            />
                        </div>

                        {/* Dynamic Filter Section */}
                        <div className="bg-card border border-border-strong rounded-xl shadow-sm overflow-hidden">
                            <div className="px-3 py-2 bg-muted border-b border-border flex justify-between items-center">
                                <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    {t('dynamicFilter')}
                                </h4>
                                <span className="text-[10px] text-text-quaternary">{t('dynamicFilterHint')}</span>
                            </div>

                            <div className="p-3 space-y-3">
                                <div className="flex gap-2">
                                    <div className="relative shrink-0">
                                        <select
                                            className="appearance-none bg-muted border border-border-strong text-text-secondary text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                                            value={dynamicFilterType}
                                            onChange={(e) => setDynamicFilterType(e.target.value)}
                                        >
                                            <option value="KEYWORD">{t('keyword')}</option>
                                            <option value="REGEX">{t('regex')}</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-tertiary">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={dynamicFilterValue}
                                            onChange={(e) => setDynamicFilterValue(e.target.value)}
                                            placeholder={dynamicFilterType === 'KEYWORD' ? t('keywordPlaceholder') : t('regexPlaceholder')}
                                            className="block w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && dynamicFilterValue.trim()) {
                                                    const key = `${dynamicFilterType}:${dynamicFilterValue.trim()}`;
                                                    if (!guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(key)) {
                                                        toggleProxySelection(key);
                                                        setDynamicFilterValue('');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (dynamicFilterValue.trim()) {
                                                const key = `${dynamicFilterType}:${dynamicFilterValue.trim()}`;
                                                if (!guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(key)) {
                                                    toggleProxySelection(key);
                                                    setDynamicFilterValue('');
                                                }
                                            }
                                        }}
                                        disabled={!dynamicFilterValue.trim()}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${dynamicFilterValue.trim()
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow shadow-indigo-200'
                                            : 'bg-muted text-text-quaternary cursor-not-allowed'
                                            }`}
                                    >
                                        {t('add')}
                                    </button>
                                </div>

                                {/* Live Preview */}
                                {dynamicFilterValue.trim() && (
                                    <div className="bg-indigo-50/50 rounded-lg border border-indigo-100 p-2.5 animate-fade-in relative">
                                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-indigo-50/50 border-t border-l border-indigo-100 transform rotate-45"></div>
                                        {(function () {
                                            let matchedProxies: typeof proxies = [];
                                            try {
                                                if (dynamicFilterType === 'KEYWORD') {
                                                    matchedProxies = proxies.filter(p => p.name.toLowerCase().includes(dynamicFilterValue.trim().toLowerCase()));
                                                } else if (dynamicFilterType === 'REGEX') {
                                                    const regex = new RegExp(dynamicFilterValue.trim());
                                                    matchedProxies = proxies.filter(p => regex.test(p.name));
                                                }
                                            } catch (e) {
                                                return (
                                                    <div className="flex items-center gap-2 text-xs text-red-500">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {t('invalidRegex')}
                                                    </div>
                                                );
                                            }

                                            if (matchedProxies.length === 0) {
                                                return (
                                                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {t('noMatchNodes')}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="font-medium text-indigo-700 flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {t('matchedNodes', { count: matchedProxies.length })}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                        {matchedProxies.slice(0, 50).map(p => (
                                                            <div key={p.id} className="px-2 py-1 bg-card text-text-secondary rounded-md border border-indigo-100 text-[10px] shadow-sm truncate max-w-[120px]" title={p.name}>
                                                                {p.name}
                                                            </div>
                                                        ))}
                                                        {matchedProxies.length > 50 && (
                                                            <span className="px-2 py-1 text-[10px] text-text-quaternary flex items-center">{t('moreNodes', { count: matchedProxies.length })}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 py-2 space-y-6 px-1 custom-scrollbar">
                        {/* Special Proxies */}
                        <div>
                            <h4 className="text-xs font-bold text-text-quaternary uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-text-quaternary"></span>
                                {t('builtinPolicies')}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                                {['DIRECT', 'REJECT', '🚀 节点选择'].map(p => {
                                    const isSelected = selectedProxies.includes(p);
                                    const isAdded = guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(p);

                                    return (
                                        <button
                                            key={p}
                                            onClick={() => {
                                                if (isAdded) return;
                                                toggleProxySelection(p);
                                            }}
                                            disabled={!!isAdded}
                                            className={`text-left px-3 py-2 rounded-lg border transition-all text-sm font-medium flex items-center justify-between ${isAdded
                                                ? 'bg-muted border-border-strong text-text-quaternary cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-accent border-blue-500 text-accent-foreground'
                                                    : 'border-border-strong hover:border-blue-500 hover:bg-accent text-text-secondary'
                                                }`}
                                        >
                                            <span>{p}</span>
                                            {isAdded ? (
                                                <span className="text-xs">{t('added')}</span>
                                            ) : isSelected && (
                                                <span className="text-blue-600 dark:text-blue-400">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                                {/* Render selected dynamic filters that are not yet added */}
                                {selectedProxies.filter(p => p.startsWith('KEYWORD:') || p.startsWith('REGEX:')).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => toggleProxySelection(p)}
                                        className="text-left px-3 py-2 rounded-lg border border-blue-500 bg-accent text-accent-foreground transition-all text-sm font-medium flex items-center justify-between"
                                    >
                                        <span className="truncate">
                                            {p.startsWith('KEYWORD:') ? `🔍 ${p.substring(8)}` : `🔡 ${p.substring(6)}`}
                                        </span>
                                        <span className="text-blue-600 dark:text-blue-400">✕</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Upstream Proxies */}
                        {Object.entries(groupedProxies).map(([source, sourceProxies]) => (
                            <div key={source} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm transition-all hover:shadow-md">
                                <div
                                    className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors select-none"
                                    onClick={() => toggleSourceCollapse(source)}
                                >
                                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full bg-card border border-border-strong flex items-center justify-center shadow-sm text-text-quaternary transform transition-transform duration-200 ${collapsedSources.includes(source) ? '-rotate-90' : ''}`}>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        {source}
                                        <span className="bg-card text-text-tertiary px-2 py-0.5 rounded-full text-[10px] border border-border-strong shadow-sm font-normal">{sourceProxies.length}</span>
                                    </h4>
                                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => {
                                                const key = `SOURCE:${source}`;
                                                const isAdded = guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(key);
                                                if (isAdded) return;
                                                toggleProxySelection(key);
                                            }}
                                            disabled={!!guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(`SOURCE:${source}`)}
                                            className={`text-[10px] px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 font-medium ${selectedProxies.includes(`SOURCE:${source}`)
                                                ? 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 ring-1 ring-purple-200 dark:ring-purple-800'
                                                : guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(`SOURCE:${source}`)
                                                    ? 'bg-muted text-text-quaternary border-border cursor-not-allowed'
                                                    : 'bg-card border-border-strong text-text-secondary hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400 hover:shadow-sm'
                                                }`}
                                            title={t('sourceAllHint')}
                                        >
                                            <span className={selectedProxies.includes(`SOURCE:${source}`) ? 'text-purple-600' : 'text-purple-400'}>
                                                {selectedProxies.includes(`SOURCE:${source}`) ? '✓' : '⚡'}
                                            </span>
                                            {selectedProxies.includes(`SOURCE:${source}`) ? t('selectedAll') : t('dynamicSelectAll')}
                                        </button>
                                        <div className="h-4 w-px bg-border-strong"></div>
                                        <button
                                            onClick={() => {
                                                const proxiesToAdd = sourceProxies
                                                    .map(p => p.name)
                                                    .filter(name => !guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(name));

                                                const allSelected = proxiesToAdd.every(name => selectedProxies.includes(name));

                                                if (allSelected) {
                                                    setSelectedProxies(prev => prev.filter(p => !proxiesToAdd.includes(p)));
                                                } else {
                                                    const newSelected = new Set([...selectedProxies, ...proxiesToAdd]);
                                                    setSelectedProxies(Array.from(newSelected));
                                                }
                                            }}
                                            className="text-[10px] text-text-tertiary hover:text-blue-600 font-medium transition-colors"
                                        >
                                            {t('selectAllDeselect')}
                                        </button>
                                    </div>
                                </div>
                                {!collapsedSources.includes(source) && (
                                    <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 border-t border-border bg-card">
                                        {sourceProxies.map(p => {
                                            const isSelected = selectedProxies.includes(p.name);
                                            const isAdded = guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(p.name);

                                            return (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        if (isAdded) return;
                                                        toggleProxySelection(p.name);
                                                    }}
                                                    disabled={!!isAdded}
                                                    className={`text-left px-3 py-2 rounded-lg border transition-all text-sm truncate flex items-center justify-between group relative ${isAdded
                                                        ? 'bg-muted border-border text-text-quaternary cursor-not-allowed opacity-60'
                                                        : isSelected
                                                            ? 'bg-accent border-blue-200 dark:border-blue-800 text-accent-foreground shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
                                                            : 'bg-card border-border-strong text-text-secondary hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5'
                                                        }`}
                                                    title={p.name}
                                                >
                                                    <span className="truncate pr-2">{p.name}</span>
                                                    {isAdded ? (
                                                        <span className="text-[10px] bg-muted text-text-tertiary px-1.5 rounded">{t('joined')}</span>
                                                    ) : isSelected && (
                                                        <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-border-strong flex gap-3">
                        <button
                            onClick={() => setShowProxySelector(false)}
                            className="flex-1 px-4 py-2 bg-muted text-text-secondary rounded-lg hover:bg-border-strong transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={addSelectedProxies}
                            disabled={selectedProxies.length === 0}
                            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${selectedProxies.length === 0
                                ? 'bg-border-strong text-text-quaternary cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {t('confirmAdd')} {selectedProxies.length > 0 && `(${selectedProxies.length})`}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
});

export default GroupEditor;
