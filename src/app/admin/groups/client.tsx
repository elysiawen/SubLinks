'use client';

import { useState } from 'react';
import { ConfigSet, saveGroupSet, deleteGroupSet } from '@/lib/config-actions';
import yaml from 'js-yaml';

interface PageProps {
    defaultGroups: any[];
    customSets: ConfigSet[];
}

interface ProxyGroup {
    id: string;
    name: string;
    type: string;
    proxies: string[];
}

export default function AdminGroupsClient({ defaultGroups, customSets }: PageProps) {
    const [editingSet, setEditingSet] = useState<ConfigSet | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Editor State
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [loading, setLoading] = useState(false);

    // Mode State
    const [editorMode, setEditorMode] = useState<'simple' | 'advanced'>('simple');
    const [guiGroups, setGuiGroups] = useState<ProxyGroup[]>([]);

    // New Group Form State
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState('select');
    const [newGroupProxies, setNewGroupProxies] = useState('');

    // Parse YAML to GUI
    const parseGroups = (yamlText: string): ProxyGroup[] => {
        try {
            const parsed = yaml.load(yamlText) as any;
            if (Array.isArray(parsed)) {
                return parsed.map((g: any) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    name: g.name || '',
                    type: g.type || 'select',
                    proxies: Array.isArray(g.proxies) ? g.proxies : []
                }));
            }
        } catch (e) {
            console.error('Parse error:', e);
        }
        return [];
    };

    // Serialize GUI to YAML
    const serializeGroups = (groups: ProxyGroup[]): string => {
        const yamlObj = groups.map(g => ({
            name: g.name,
            type: g.type,
            proxies: g.proxies
        }));
        return yaml.dump(yamlObj);
    };

    // Sync Text to GUI
    const syncTextToGui = () => {
        setGuiGroups(parseGroups(formContent));
    };

    // Sync GUI to Text
    const syncGuiToText = (groups: ProxyGroup[]) => {
        setGuiGroups(groups);
        setFormContent(serializeGroups(groups));
    };

    // Add Group
    const addGroup = () => {
        if (!newGroupName) return;
        const proxies = newGroupProxies.split('\n').map(p => p.trim()).filter(p => p);
        const newGroup: ProxyGroup = {
            id: Math.random().toString(36).substr(2, 9),
            name: newGroupName,
            type: newGroupType,
            proxies
        };
        const updated = [...guiGroups, newGroup];
        syncGuiToText(updated);
        setNewGroupName('');
        setNewGroupProxies('');
    };

    // Remove Group
    const removeGroup = (id: string) => {
        const updated = guiGroups.filter(g => g.id !== id);
        syncGuiToText(updated);
    };

    const openEditor = (set?: ConfigSet) => {
        if (set) {
            setEditingSet(set);
            setFormName(set.name);
            setFormContent(set.content);
            setGuiGroups(parseGroups(set.content));
        } else {
            setEditingSet(null);
            setFormName('');
            setFormContent('');
            setGuiGroups([]);
        }
        setEditorMode('simple');
        setIsEditorOpen(true);
    };

    const handleSave = async () => {
        if (!formName || !formContent) return alert('请填写完整');
        setLoading(true);
        await saveGroupSet(editingSet ? editingSet.id : null, formName, formContent);
        setLoading(false);
        setIsEditorOpen(false);
    };

    const [viewingDefault, setViewingDefault] = useState(false);
    const GroupTypes = ['select', 'url-test', 'fallback', 'load-balance'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">🤖 策略组配置</h2>
                <button
                    onClick={() => openEditor()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                    <span>+</span> 新建配置
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">配置名称</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">最后更新</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></div>
                                    <span className="text-sm font-medium text-gray-900">默认配置 (Upstream)</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">系统默认</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Auto-Sync</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => setViewingDefault(true)} className="text-blue-600 hover:text-blue-900">查看详情</button>
                            </td>
                        </tr>

                        {customSets.map((set) => (
                            <tr key={set.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{set.name}</div>
                                    <div className="text-xs text-gray-400">ID: {set.id}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">自定义</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(set.updatedAt).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                    <button onClick={() => openEditor(set)} className="text-indigo-600 hover:text-indigo-900">编辑</button>
                                    <button onClick={async () => { if (confirm(`确定删除 ${set.name}?`)) await deleteGroupSet(set.id); }} className="text-red-600 hover:text-red-900">删除</button>
                                </td>
                            </tr>
                        ))}
                        {customSets.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-400 italic">暂无自定义配置</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {viewingDefault && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">默认策略组详情</h3>
                            <button onClick={() => setViewingDefault(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <div className="overflow-y-auto flex-1 pr-2">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {defaultGroups.map((group, idx) => (
                                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-700">{group.name}</h4>
                                            <span className="text-xs bg-white border px-1.5 rounded text-gray-500">{group.type}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.proxies?.map((p: string, i: number) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white border rounded text-gray-600">{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {defaultGroups.length === 0 && <p className="text-gray-400 text-center col-span-2">No defaults found.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isEditorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4">{editingSet ? '编辑策略配置' : '新建策略配置'}</h3>

                        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">配置名称</label>
                                <input className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" value={formName} onChange={e => setFormName(e.target.value)} placeholder="例如：精简分组 (无回国)" />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">策略组内容</label>
                                    <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                        <button onClick={() => { setEditorMode('simple'); syncTextToGui(); }} className={`px-3 py-1 rounded-md transition-all ${editorMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}>简易模式</button>
                                        <button onClick={() => setEditorMode('advanced')} className={`px-3 py-1 rounded-md transition-all ${editorMode === 'advanced' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}>高级模式</button>
                                    </div>
                                </div>

                                {editorMode === 'advanced' ? (
                                    <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono text-xs h-96 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none bg-gray-50" value={formContent} onChange={e => setFormContent(e.target.value)} placeholder={`- name: 🚀 Proxy\n  type: select\n  proxies:\n    - ♻️ Auto\n    - 🇭🇰 HongKong\n\n- name: 🍎 Apple\n  type: select\n  proxies:\n    - DIRECT\n    - 🚀 Proxy`} />
                                ) : (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                        <div className="p-4 bg-white border-b border-gray-100">
                                            <div className="grid grid-cols-12 gap-3 items-end">
                                                <div className="col-span-4">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">策略组名称</label>
                                                    <input className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500" placeholder="🚀 Proxy" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">类型</label>
                                                    <select className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500 bg-white" value={newGroupType} onChange={e => setNewGroupType(e.target.value)}>
                                                        {GroupTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">代理列表 (每行一个)</label>
                                                    <textarea className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500 resize-none" rows={2} placeholder="DIRECT&#10;♻️ Auto&#10;🇭🇰 HongKong" value={newGroupProxies} onChange={e => setNewGroupProxies(e.target.value)} />
                                                </div>
                                                <div className="col-span-1">
                                                    <button onClick={addGroup} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors">
                                                        <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                                            {guiGroups.map((group) => (
                                                <div key={group.id} className="bg-white p-3 rounded-lg border border-gray-200 group hover:border-blue-200 transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-800">{group.name}</span>
                                                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{group.type}</span>
                                                        </div>
                                                        <button onClick={() => removeGroup(group.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {group.proxies.map((proxy, idx) => (
                                                            <span key={idx} className="text-xs px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-blue-700">{proxy}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {guiGroups.length === 0 && <div className="text-center text-gray-400 text-sm py-12 italic">添加策略组...</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsEditorOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100">取消</button>
                            <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">{loading ? '保存中...' : '保存'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
