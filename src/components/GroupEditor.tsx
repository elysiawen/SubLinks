'use client';

import { useState, useMemo, useEffect } from 'react';
import Modal from '@/components/Modal';

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

export default function GroupEditor({ value, onChange, proxies, className }: GroupEditorProps) {
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
                    id: Math.random().toString(36).substr(2, 9)
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
            id: Math.random().toString(36).substr(2, 9)
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
                <label className="block text-sm font-medium text-gray-700">
                    策略组内容
                </label>
                <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                    <button
                        onClick={() => handleSwitchMode('simple')}
                        disabled={isSwitching}
                        className={`px-3 py-1 rounded-md transition-all ${groupMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'} ${isSwitching ? 'opacity-50' : ''}`}
                    >
                        简易模式
                    </button>
                    <button
                        onClick={() => handleSwitchMode('advanced')}
                        disabled={isSwitching}
                        className={`px-3 py-1 rounded-md transition-all ${groupMode === 'advanced' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'} ${isSwitching ? 'opacity-50' : ''}`}
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
            ) : groupMode === 'advanced' ? (
                <div>
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        rows={15}
                        placeholder="- name: 🚀 节点选择&#10;  type: select&#10;  proxies:&#10;    - DIRECT&#10;    - 🇭🇰 香港节点"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        YAML 格式的策略组配置
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Add Group Form */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addGuiGroup()}
                                placeholder="策略组名称"
                                className="w-full sm:flex-1 sm:min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent order-1 sm:order-1"
                            />
                            <div className="flex gap-2 w-full sm:w-auto order-2 sm:order-2">
                                <select
                                    value={newGroupType}
                                    onChange={(e) => setNewGroupType(e.target.value)}
                                    className="flex-1 sm:w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                            <svg className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={groupSearch}
                            onChange={(e) => setGroupSearch(e.target.value)}
                            placeholder="搜索策略组名称、类型..."
                            className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        />
                    </div>

                    {/* Groups List */}
                    {filteredGroups.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-8 border border-dashed border-gray-300 rounded-lg">
                            {groupSearch ? '没有找到匹配的策略组' : '暂无策略组，请添加'}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredGroups.map((group) => (
                                <div key={group.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-800">{group.name}</span>
                                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                                                {group.type}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeGuiGroup(group.id)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            删除组
                                        </button>
                                    </div>

                                    {/* Proxies */}
                                    <div className="space-y-2">
                                        {group.proxies.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {group.proxies.map((proxy, idx) => {
                                                    let badgeClass = 'bg-blue-50 text-blue-700';
                                                    let displayText = proxy;

                                                    if (proxy.startsWith('SOURCE:')) {
                                                        badgeClass = 'bg-purple-100 text-purple-700 border border-purple-200';
                                                        displayText = `📚 全量: ${proxy.substring(7)}`;
                                                    } else if (proxy.startsWith('KEYWORD:')) {
                                                        badgeClass = 'bg-amber-100 text-amber-700 border border-amber-200';
                                                        displayText = `🔍 包含: ${proxy.substring(8)}`;
                                                    } else if (proxy.startsWith('REGEX:')) {
                                                        badgeClass = 'bg-pink-100 text-pink-700 border border-pink-200';
                                                        displayText = `🔡 正则: ${proxy.substring(6)}`;
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
                                            className="w-full py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 text-sm transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span>+ 添加节点</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-gray-400">
                        共 {guiGroups.length} 个策略组
                    </p>
                </div>
            )}

            {/* Proxy Selector Modal */}
            <Modal
                isOpen={showProxySelector}
                onClose={() => setShowProxySelector(false)}
                title="选择节点"
                maxWidth="max-w-2xl"
                zIndex={60}
            >
                <div className="flex flex-col h-[65vh]">
                    <div className="border-b border-gray-100 space-y-4 shrink-0 pb-4 px-1">
                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={proxySearch}
                                onChange={(e) => setProxySearch(e.target.value)}
                                placeholder="搜索节点..."
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                            />
                        </div>

                        {/* Dynamic Filter Section */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    动态过滤
                                </h4>
                                <span className="text-[10px] text-gray-400">自动包含未来新增的匹配节点</span>
                            </div>

                            <div className="p-3 space-y-3">
                                <div className="flex gap-2">
                                    <div className="relative shrink-0">
                                        <select
                                            className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                                            value={dynamicFilterType}
                                            onChange={(e) => setDynamicFilterType(e.target.value)}
                                        >
                                            <option value="KEYWORD">关键字</option>
                                            <option value="REGEX">正则</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
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
                                            placeholder={dynamicFilterType === 'KEYWORD' ? "输入包含的关键字..." : "输入匹配的正则表达式..."}
                                            className="block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
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
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        添加
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
                                                        无效的正则表达式
                                                    </div>
                                                );
                                            }

                                            if (matchedProxies.length === 0) {
                                                return (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        未找到匹配的节点
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
                                                            找到 {matchedProxies.length} 个匹配节点
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                        {matchedProxies.slice(0, 50).map(p => (
                                                            <div key={p.id} className="px-2 py-1 bg-white text-gray-600 rounded-md border border-indigo-100 text-[10px] shadow-sm truncate max-w-[120px]" title={p.name}>
                                                                {p.name}
                                                            </div>
                                                        ))}
                                                        {matchedProxies.length > 50 && (
                                                            <span className="px-2 py-1 text-[10px] text-gray-400 flex items-center">...等共 {matchedProxies.length} 个</span>
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
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                内置策略
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
                                                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                    : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700'
                                                }`}
                                        >
                                            <span>{p}</span>
                                            {isAdded ? (
                                                <span className="text-xs">已添加</span>
                                            ) : isSelected && (
                                                <span className="text-blue-600">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                                {/* Render selected dynamic filters that are not yet added */}
                                {selectedProxies.filter(p => p.startsWith('KEYWORD:') || p.startsWith('REGEX:')).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => toggleProxySelection(p)}
                                        className="text-left px-3 py-2 rounded-lg border border-blue-500 bg-blue-50 text-blue-700 transition-all text-sm font-medium flex items-center justify-between"
                                    >
                                        <span className="truncate">
                                            {p.startsWith('KEYWORD:') ? `🔍 ${p.substring(8)}` : `🔡 ${p.substring(6)}`}
                                        </span>
                                        <span className="text-blue-600">✕</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Upstream Proxies */}
                        {Object.entries(groupedProxies).map(([source, sourceProxies]) => (
                            <div key={source} className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                                <div
                                    className="flex items-center justify-between p-3 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                                    onClick={() => toggleSourceCollapse(source)}
                                >
                                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm text-gray-400 transform transition-transform duration-200 ${collapsedSources.includes(source) ? '-rotate-90' : ''}`}>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        {source}
                                        <span className="bg-white text-gray-500 px-2 py-0.5 rounded-full text-[10px] border border-gray-200 shadow-sm font-normal">{sourceProxies.length}</span>
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
                                                ? 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-200'
                                                : guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(`SOURCE:${source}`)
                                                    ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600 hover:shadow-sm'
                                                }`}
                                            title="动态包含该源所有节点，自动更新"
                                        >
                                            <span className={selectedProxies.includes(`SOURCE:${source}`) ? 'text-purple-600' : 'text-purple-400'}>
                                                {selectedProxies.includes(`SOURCE:${source}`) ? '✓' : '⚡'}
                                            </span>
                                            {selectedProxies.includes(`SOURCE:${source}`) ? '已选全量' : '动态全选'}
                                        </button>
                                        <div className="h-4 w-px bg-gray-200"></div>
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
                                            className="text-[10px] text-gray-500 hover:text-blue-600 font-medium transition-colors"
                                        >
                                            全选/取消
                                        </button>
                                    </div>
                                </div>
                                {!collapsedSources.includes(source) && (
                                    <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 border-t border-gray-100 bg-white">
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
                                                        ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                                                        : isSelected
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-200'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
                                                        }`}
                                                    title={p.name}
                                                >
                                                    <span className="truncate pr-2">{p.name}</span>
                                                    {isAdded ? (
                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded">已加入</span>
                                                    ) : isSelected && (
                                                        <span className="text-blue-600 flex-shrink-0">
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

                    <div className="pt-4 border-t border-gray-200 flex gap-3">
                        <button
                            onClick={() => setShowProxySelector(false)}
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={addSelectedProxies}
                            disabled={selectedProxies.length === 0}
                            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${selectedProxies.length === 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            确认添加 {selectedProxies.length > 0 && `(${selectedProxies.length})`}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
