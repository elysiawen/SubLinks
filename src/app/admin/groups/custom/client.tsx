'use client';

import { useState, useMemo } from 'react';
import { saveCustomGroup, deleteCustomGroup } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';

interface ConfigSet {
    id: string;
    name: string;
    content: string;
    updatedAt: number;
}

interface ProxyItem {
    id: string;
    name: string;
    type: string;
    source: string;
}

export default function CustomGroupsClient({
    customGroups: initialGroups,
    initialProxies
}: {
    customGroups: ConfigSet[],
    initialProxies: ProxyItem[]
}) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [groups, setGroups] = useState<ConfigSet[]>(initialGroups);
    const [proxies] = useState<ProxyItem[]>(initialProxies);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [loading, setLoading] = useState(false);

    // Group Builder State
    const [groupMode, setGroupMode] = useState<'simple' | 'advanced'>('simple');

    // Helper to parse groups from text
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

    // Helper to stringify groups
    const stringifyGroups = (groups: { name: string, type: string, proxies: string[] }[]) => {
        return groups.map(g => {
            const proxies = g.proxies.map(p => `    - ${p}`).join('\n');
            return `- name: ${g.name}\n  type: ${g.type}\n  proxies:\n${proxies}`;
        }).join('\n');
    };

    // GUI State
    const [guiGroups, setGuiGroups] = useState<{ name: string, type: string, proxies: string[], id: string }[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState('select');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

    // Proxy Selector State
    const [showProxySelector, setShowProxySelector] = useState(false);
    const [selectorGroupId, setSelectorGroupId] = useState<string | null>(null);
    const [proxySearch, setProxySearch] = useState('');
    const [selectedProxies, setSelectedProxies] = useState<string[]>([]);

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
                // Filter out duplicates
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

    // Group proxies by source
    const groupedProxies = useMemo(() => {
        const grouped: Record<string, ProxyItem[]> = {};
        proxies.filter(p => p.name.toLowerCase().includes(proxySearch.toLowerCase())).forEach(p => {
            if (!grouped[p.source]) grouped[p.source] = [];
            grouped[p.source].push(p);
        });
        return grouped;
    }, [proxies, proxySearch]);

    // Sync Text to GUI
    const syncTextToGui = (text: string) => {
        setGuiGroups(parseGroups(text));
    };

    // Sync GUI to Text
    const updateGuiGroups = (newGroups: typeof guiGroups) => {
        setGuiGroups(newGroups);
        setFormContent(stringifyGroups(newGroups));
    };

    const openCreate = () => {
        setEditingId(null);
        setFormName('');
        setFormContent('');
        setGroupMode('simple');
        setGuiGroups([]);
        setIsEditing(true);
    };

    const openEdit = (group: ConfigSet) => {
        setEditingId(group.id);
        setFormName(group.name);
        setFormContent(group.content);
        setGroupMode('simple');
        syncTextToGui(group.content);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!formName.trim() || !formContent.trim()) {
            error('请填写完整的名称和内容');
            return;
        }

        setLoading(true);
        await saveCustomGroup(editingId, formName.trim(), formContent.trim());
        setLoading(false);
        setIsEditing(false);
        success(editingId ? '策略组更新成功' : '策略组创建成功');
        window.location.reload();
    };

    const handleDelete = async (id: string, name: string) => {
        if (!await confirm(`确定要删除自定义策略组 "${name}" 吗？`, { confirmColor: 'red' })) {
            return;
        }

        setLoading(true);
        await deleteCustomGroup(id);
        setLoading(false);
        success('策略组已删除');
        window.location.reload();
    };

    const addGuiGroup = () => {
        if (!newGroupName.trim()) {
            error('请填写策略组名称');
            return;
        }
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

    const openProxySelector = (groupId: string) => {
        setSelectorGroupId(groupId);
        setProxySearch('');
        setSelectedProxies([]);
        setShowProxySelector(true);
    };

    const addProxyToGroup = (proxyName: string) => {
        if (!selectorGroupId) return;
        const updatedGroups = guiGroups.map(g => {
            if (g.id === selectorGroupId && !g.proxies.includes(proxyName)) {
                return { ...g, proxies: [...g.proxies, proxyName] };
            }
            return g;
        });
        updateGuiGroups(updatedGroups);
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">📝 自定义策略组管理</h2>
                    <p className="text-sm text-gray-500 mt-1">创建和管理自定义策略组配置</p>
                </div>
                <div className="flex gap-2">
                    <a
                        href="/admin/groups"
                        className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                        ← 返回列表
                    </a>
                    <button
                        onClick={openCreate}
                        className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        + 新建策略组
                    </button>
                </div>
            </div>

            {/* Proxy Selector Modal */}
            {showProxySelector && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-semibold text-gray-800">选择节点</h3>
                            <button
                                onClick={() => setShowProxySelector(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 border-b space-y-3">
                            <input
                                type="text"
                                value={proxySearch}
                                onChange={(e) => setProxySearch(e.target.value)}
                                placeholder="搜索节点..."
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />

                            {selectedProxies.length > 0 && (
                                <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                    <span className="text-sm text-blue-700">
                                        已选 {selectedProxies.length} 个节点
                                    </span>
                                    <button
                                        onClick={addSelectedProxies}
                                        className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        确认添加
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-6">
                            {/* Special Proxies */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">内置策略</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                                </div>
                            </div>

                            {/* Upstream Proxies */}
                            {Object.entries(groupedProxies).map(([source, sourceProxies]) => (
                                <div key={source}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                            {source}
                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{sourceProxies.length}</span>
                                        </h4>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const proxiesToAdd = sourceProxies
                                                        .map(p => p.name)
                                                        .filter(name => !guiGroups.find(g => g.id === selectorGroupId)?.proxies.includes(name));

                                                    // Check if all available proxies are already selected
                                                    const allSelected = proxiesToAdd.every(name => selectedProxies.includes(name));

                                                    if (allSelected) {
                                                        // Deselect all
                                                        setSelectedProxies(prev => prev.filter(p => !proxiesToAdd.includes(p)));
                                                    } else {
                                                        // Select all unselected
                                                        const newSelected = new Set([...selectedProxies, ...proxiesToAdd]);
                                                        setSelectedProxies(Array.from(newSelected));
                                                    }
                                                }}
                                                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                全选/取消
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                                                    className={`text-left px-3 py-2 rounded-lg border transition-all text-sm truncate flex items-center justify-between ${isAdded
                                                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                                        : isSelected
                                                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                            : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700'
                                                        }`}
                                                    title={p.name}
                                                >
                                                    <span className="truncate">{p.name}</span>
                                                    {isSelected && !isAdded && (
                                                        <span className="text-blue-600 ml-2 flex-shrink-0">✓</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isEditing && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        {editingId ? '编辑策略组' : '新建策略组'}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">配置名称</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="例如：自定义香港节点组"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-semibold text-gray-700">策略组内容</label>
                                <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                    <button
                                        onClick={() => {
                                            setGroupMode('simple');
                                            syncTextToGui(formContent);
                                        }}
                                        className={`px-3 py-1 rounded-md transition-all ${groupMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}
                                    >
                                        简易模式
                                    </button>
                                    <button
                                        onClick={() => setGroupMode('advanced')}
                                        className={`px-3 py-1 rounded-md transition-all ${groupMode === 'advanced' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}
                                    >
                                        高级模式
                                    </button>
                                </div>
                            </div>

                            {groupMode === 'advanced' ? (
                                <div>
                                    <textarea
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm"
                                        rows={15}
                                        placeholder={`- name: 🇭🇰 香港节点\n  type: select\n  proxies:\n    - DIRECT\n    - 🚀 节点选择`}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        YAML 格式的策略组配置
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Add Group Form */}
                                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="grid grid-cols-12 gap-2">
                                            <input
                                                type="text"
                                                value={newGroupName}
                                                onChange={(e) => setNewGroupName(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && addGuiGroup()}
                                                placeholder="策略组名称"
                                                className="col-span-7 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                            <select
                                                value={newGroupType}
                                                onChange={(e) => setNewGroupType(e.target.value)}
                                                className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            >
                                                <option value="select">select</option>
                                                <option value="url-test">url-test</option>
                                                <option value="fallback">fallback</option>
                                                <option value="load-balance">load-balance</option>
                                            </select>
                                            <button
                                                onClick={addGuiGroup}
                                                className="col-span-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {/* Groups List */}
                                    {guiGroups.length === 0 ? (
                                        <div className="text-center text-gray-400 text-sm py-8 border border-dashed border-gray-300 rounded-lg">
                                            暂无策略组,请添加
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {guiGroups.map((group) => (
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
                                                                {group.proxies.map((proxy, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                                                                    >
                                                                        {proxy}
                                                                        <button
                                                                            onClick={() => removeProxyFromGroup(group.id, idx)}
                                                                            className="hover:text-red-600"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </span>
                                                                ))}
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
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                            >
                                {loading ? '保存中...' : '保存'}
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {groups.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无自定义策略组,点击上方按钮创建
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {groups.map((group) => (
                        <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                                    <p className="text-xs text-gray-400 mt-1">
                                        更新时间: {new Date(group.updatedAt).toLocaleString('zh-CN')}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEdit(group)}
                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                        编辑
                                    </button>
                                    <button
                                        onClick={() => handleDelete(group.id, group.name)}
                                        disabled={loading}
                                        className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                                    >
                                        删除
                                    </button>
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
                                    {group.content}
                                </pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
