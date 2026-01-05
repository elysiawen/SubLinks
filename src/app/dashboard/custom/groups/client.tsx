'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { saveGroupSet, deleteGroupSet, type ConfigSet } from '@/lib/config-actions';
import Modal from '@/components/Modal';
import { useRouter } from 'next/navigation';

interface GroupsClientProps {
    groups: ConfigSet[];
    proxies: Array<{ id: string; name: string; type: string; source: string }>;
}

export default function GroupsClient({ groups: initialGroups, proxies }: GroupsClientProps) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const router = useRouter();
    const [groups, setGroups] = useState(initialGroups);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ConfigSet | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupContent, setGroupContent] = useState('');
    const [loading, setLoading] = useState(false);

    // Mode toggle
    const [groupMode, setGroupMode] = useState<'simple' | 'advanced'>('simple');

    // Simple mode state
    const [guiGroups, setGuiGroups] = useState<{ name: string, type: string, proxies: string[], id: string }[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState('select');

    // Proxy Selector State
    const [showProxySelector, setShowProxySelector] = useState(false);
    const [selectorGroupId, setSelectorGroupId] = useState<string | null>(null);
    const [proxySearch, setProxySearch] = useState('');
    const [selectedProxies, setSelectedProxies] = useState<string[]>([]);

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

    const syncTextToGui = (text: string) => {
        setGuiGroups(parseGroups(text));
    };

    const updateGuiGroups = (newGroups: typeof guiGroups) => {
        setGuiGroups(newGroups);
        setGroupContent(stringifyGroups(newGroups));
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

    const groupedProxies = useMemo(() => {
        const grouped: Record<string, typeof proxies> = {};
        proxies.filter(p => p.name.toLowerCase().includes(proxySearch.toLowerCase())).forEach(p => {
            if (!grouped[p.source]) grouped[p.source] = [];
            grouped[p.source].push(p);
        });
        return grouped;
    }, [proxies, proxySearch]);

    const handleCreate = () => {
        setEditingGroup(null);
        setGroupName('');
        setGroupContent('');
        setGroupMode('simple');
        setGuiGroups([]);
        setIsModalOpen(true);
    };

    const handleEdit = (group: ConfigSet) => {
        setEditingGroup(group);
        setGroupName(group.name);
        setGroupContent(group.content);
        setGroupMode('simple');
        syncTextToGui(group.content);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!groupName.trim()) {
            error('请输入分组名称');
            return;
        }

        if (!groupContent.trim()) {
            error('请输入分组内容');
            return;
        }

        setLoading(true);
        try {
            await saveGroupSet(editingGroup?.id || null, groupName, groupContent);
            success(editingGroup ? '分组已更新' : '分组已创建');
            setIsModalOpen(false);
            router.refresh();
        } catch (err) {
            error('保存失败: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (group: ConfigSet) => {
        const confirmed = await confirm(
            `确定要删除分组 "${group.name}" 吗？此操作不可撤销。`
        );

        if (!confirmed) return;

        try {
            await deleteGroupSet(group.id);
            success('分组已删除');
            router.refresh();
        } catch (err) {
            error('删除失败: ' + (err as Error).message);
        }
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

    const removeProxyFromGroup = (groupId: string, proxyIndex: number) => {
        const updatedGroups = guiGroups.map(g => {
            if (g.id === groupId) {
                return { ...g, proxies: g.proxies.filter((_, i) => i !== proxyIndex) };
            }
            return g;
        });
        updateGuiGroups(updatedGroups);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">自定义分组</h1>
                    <p className="text-sm text-gray-500 mt-1">管理您的策略组配置</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <span>➕</span>
                    <span>新建分组</span>
                </button>
            </div>

            {/* Groups List */}
            {groups.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">暂无自定义分组</h3>
                    <p className="text-gray-500 mb-6">创建您的第一个策略组配置</p>
                    <button
                        onClick={handleCreate}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        立即创建
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                                        {group.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        更新于 {formatDate(group.updatedAt)}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all">
                                    {group.content.substring(0, 200)}
                                    {group.content.length > 200 && '...'}
                                </pre>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(group)}
                                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                >
                                    编辑
                                </button>
                                <button
                                    onClick={() => handleDelete(group)}
                                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ))}
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
                <div className="flex flex-col h-[60vh]">
                    <div className="border-b space-y-3 shrink-0 pb-4">
                        <input
                            type="text"
                            value={proxySearch}
                            onChange={(e) => setProxySearch(e.target.value)}
                            placeholder="搜索节点..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                    <div className="overflow-y-auto flex-1 py-4 space-y-6">
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
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        全选/取消
                                    </button>
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

                    <div className="pt-4 border-t border-gray-200">
                        <button
                            onClick={() => setShowProxySelector(false)}
                            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit/Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingGroup ? '编辑分组' : '新建分组'}
                maxWidth="max-w-4xl"
            >
                <div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                分组名称
                            </label>
                            <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="例如: 我的策略组"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    分组内容
                                </label>
                                <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                    <button
                                        onClick={() => {
                                            setGroupMode('simple');
                                            syncTextToGui(groupContent);
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
                                        value={groupContent}
                                        onChange={(e) => setGroupContent(e.target.value)}
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
                                        <div className="grid grid-cols-12 gap-2">
                                            <input
                                                type="text"
                                                value={newGroupName}
                                                onChange={(e) => setNewGroupName(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && addGuiGroup()}
                                                placeholder="策略组名称"
                                                className="col-span-7 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            <select
                                                value={newGroupType}
                                                onChange={(e) => setNewGroupType(e.target.value)}
                                                className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                            暂无策略组，请添加
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
                    </div>

                    <div className="pt-6 border-t border-gray-200 flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            disabled={loading}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
