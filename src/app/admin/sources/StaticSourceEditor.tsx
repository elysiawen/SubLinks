'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import GroupEditor from '@/components/GroupEditor';
import RuleEditor from '@/components/RuleEditor';
import NodeInputPanel, { type ManualNodeConfig } from '@/components/NodeInputPanel';
import { PROTOCOL_COLORS } from '@/lib/constants';
import yaml from 'js-yaml';
import {
    getStaticSourceData,
    saveStaticSourceNodes,
    saveStaticSourceGroups,
    saveStaticSourceRules,
    importStaticSourceData,
    previewParseContent,
} from './actions';

interface StaticSourceEditorProps {
    sourceName: string;
    open: boolean;
    onClose: () => void;
    onUpdate: () => void;
    defaultTab?: 'nodes' | 'groups' | 'rules';
}

interface NodeData {
    id: string;
    name: string;
    type: string;
    server: string;
    port: number;
    config: any;
}

interface GroupData {
    id: string;
    name: string;
    type: string;
    proxies: string[];
    config?: any;
}

interface RuleData {
    id: string;
    ruleText: string;
    priority: number;
}

export default function StaticSourceEditor({ sourceName, open, onClose, onUpdate, defaultTab = 'nodes' }: StaticSourceEditorProps) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    const [tab, setTab] = useState<'nodes' | 'groups' | 'rules'>(defaultTab);
    const [loading, setLoading] = useState(true);

    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [hasNodeChanges, setHasNodeChanges] = useState(false);
    const [savingNodes, setSavingNodes] = useState(false);

    const [groups, setGroups] = useState<GroupData[]>([]);
    const [hasGroupChanges, setHasGroupChanges] = useState(false);
    const [groupsText, setGroupsText] = useState('');
    const [savingGroups, setSavingGroups] = useState(false);

    const [rules, setRules] = useState<RuleData[]>([]);
    const [hasRuleChanges, setHasRuleChanges] = useState(false);
    const [rulesText, setRulesText] = useState('');
    const [savingRules, setSavingRules] = useState(false);

    const [nodeSearch, setNodeSearch] = useState('');
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [deletingNodes, setDeletingNodes] = useState(false);

    const [importPreview, setImportPreview] = useState<{
        proxies: any[], groups: any[], rules: string[]
    } | null>(null);
    const [importOptions, setImportOptions] = useState({
        nodes: true, groups: false, rules: false,
        nodeMode: 'append' as 'append' | 'overwrite',
        groupMode: 'append' as 'append' | 'overwrite',
        ruleMode: 'append' as 'append' | 'overwrite'
    });
    const [isImporting, setIsImporting] = useState(false);

    const nextId = useRef(0);
    const genId = useCallback(() => `tmp_${++nextId.current}_${Date.now()}`, []);

    const memoizedProxies = useMemo(() =>
        nodes.map(n => ({ id: n.id, name: n.name, type: n.type, source: sourceName })),
        [nodes, sourceName]
    );

    const memoizedGroups = useMemo(() =>
        groups.map(g => ({ name: g.name, type: g.type, source: sourceName })),
        [groups, sourceName]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getStaticSourceData(sourceName);
            if ('error' in result) {
                error(result.error!);
                return;
            }
            setNodes(result.proxies as NodeData[]);

            const groupData = result.groups as GroupData[];
            setGroups(groupData);
            const groupYaml = yaml.dump(groupData.map(g => ({
                name: g.name, type: g.type, proxies: g.proxies
            })));
            setTimeout(() => { setGroupsText(groupYaml); setHasGroupChanges(false); }, 0);

            const ruleData = result.rules as RuleData[];
            setRules(ruleData);
            setTimeout(() => { setRulesText(ruleData.map(r => r.ruleText).join('\n')); setHasRuleChanges(false); }, 0);
        } catch (e) {
            error('加载数据失败: ' + String(e));
        }
        setLoading(false);
    }, [sourceName, error]);

    useEffect(() => {
        if (!open) {
            setHasNodeChanges(false);
            setHasGroupChanges(false);
            setHasRuleChanges(false);
        } else {
            loadData();
            if (defaultTab) setTab(defaultTab);
        }
    }, [open, loadData, defaultTab]);

    const handleGroupsTextChange = useCallback((text: string) => {
        setGroupsText(text);
        setHasGroupChanges(true);
    }, []);

    const handleRulesTextChange = useCallback((text: string) => {
        setRulesText(text);
        setHasRuleChanges(true);
    }, []);

    // === Nodes actions ===
    const handlePreviewImport = async (text: string, type: 'links' | 'config') => {
        const content = text.trim();
        if (!content) { error('请输入内容再解析'); return; }
        try {
            const preview = await previewParseContent(content);
            if (preview.proxies.length === 0 && preview.groups.length === 0 && preview.rules.length === 0) {
                error('未能解析到任何有效数据');
            } else {
                setImportPreview(preview);
                setImportOptions(prev => ({
                    ...prev,
                    nodes: preview.proxies.length > 0,
                    groups: preview.groups.length > 0,
                    rules: preview.rules.length > 0,
                }));
            }
        } catch (e) {
            error('解析失败: ' + String(e));
        }
    };

    const handleConfirmImport = async () => {
        if (!importPreview) return;
        try {
            if (importOptions.nodes && importPreview.proxies.length > 0) {
                const newNodes = importPreview.proxies.map((p: any) => ({
                    id: genId(), name: p.name, type: p.type,
                    server: p.server || p.config?.server, port: p.port || p.config?.port,
                    config: p.config || p,
                }));
                if (importOptions.nodeMode === 'overwrite') setNodes(newNodes);
                else setNodes(prev => [...prev, ...newNodes]);
                setHasNodeChanges(true);
            }

            if (importOptions.groups || importOptions.rules) {
                setIsImporting(true);
                const result = await importStaticSourceData(sourceName, {
                    nodes: [], groups: importPreview.groups, rules: importPreview.rules
                }, {
                    importNodes: false, importGroups: importOptions.groups, importRules: importOptions.rules,
                    nodeMode: 'append', groupMode: importOptions.groupMode, ruleMode: importOptions.ruleMode
                });
                if ('error' in result) { error(result.error!); setIsImporting(false); return; }
                success(`已${importOptions.nodes ? '暂存节点并' : ''}导入${importOptions.groups && importOptions.rules ? '策略组和规则' : (importOptions.groups ? '策略组' : '规则')}`);
                setImportPreview(null);
                loadData();
                onUpdate();
                setIsImporting(false);
                return;
            }

            success('节点已成功解析并暂存，请记得点击下方"保存节点配置"提交');
            setImportPreview(null);
        } catch (e) {
            error('导入失败: ' + String(e));
        }
    };

    const handleAddManualNode = async (node: ManualNodeConfig) => {
        setNodes(prev => [...prev, {
            id: genId(), name: node.name, type: node.type,
            server: node.server, port: node.port, config: node.config,
        }]);
        setHasNodeChanges(true);
        success(`已暂存节点: ${node.name}，请记得点击保存`);
    };

    const handleDeleteNode = async (nodeId: string, nodeName: string) => {
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        setSelectedNodeIds(prev => { const next = new Set(prev); next.delete(nodeId); return next; });
        setHasNodeChanges(true);
    };

    const handleDeleteSelectedNodes = async () => {
        if (selectedNodeIds.size === 0) return;
        const count = selectedNodeIds.size;
        setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
        setSelectedNodeIds(new Set());
        setHasNodeChanges(true);
        success(`已移除 ${count} 个节点（未保存）`);
    };

    const handleSaveNodes = async () => {
        setSavingNodes(true);
        try {
            const nodesToSave = nodes.map(n => ({
                name: n.name, type: n.type, server: n.server, port: n.port, config: n.config,
            }));
            const result = await saveStaticSourceNodes(sourceName, nodesToSave);
            if ('error' in result) error(result.error!);
            else { success('节点配置已保存'); setHasNodeChanges(false); loadData(); onUpdate(); }
        } catch (e) { error('保存失败: ' + String(e)); }
        setSavingNodes(false);
    };

    const handleSaveGroups = async () => {
        if (!groupsText.trim()) { error('请输入策略组内容'); return; }
        setSavingGroups(true);
        try {
            const parsed = yaml.load(groupsText) as any;
            const parsedArray = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            if (parsedArray.length === 0) { error('至少保留一个策略组'); setSavingGroups(false); return; }
            const result = await saveStaticSourceGroups(sourceName, parsedArray.map((g: any) => ({ name: g.name, type: g.type, proxies: g.proxies || [] })));
            if ('error' in result) { error(result.error!); }
            else { success('策略组已保存'); setHasGroupChanges(false); loadData(); onUpdate(); }
        } catch (e) { error('保存失败: 检查 YAML 格式 (' + String(e) + ')'); }
        setSavingGroups(false);
    };

    const handleSaveRules = async () => {
        setSavingRules(true);
        try {
            const lines = rulesText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.replace(/^-\s*/, '').trim());
            const result = await saveStaticSourceRules(sourceName, lines);
            if ('error' in result) { error(result.error!); }
            else { success('规则已保存'); setHasRuleChanges(false); loadData(); onUpdate(); }
        } catch (e) { error('保存失败: ' + String(e)); }
        setSavingRules(false);
    };

    const filteredNodes = nodes.filter(n =>
        n.name.toLowerCase().includes(nodeSearch.toLowerCase()) ||
        n.server.toLowerCase().includes(nodeSearch.toLowerCase()) ||
        n.type.toLowerCase().includes(nodeSearch.toLowerCase())
    );

    const tabs = [
        { key: 'nodes' as const, label: '节点', emoji: '📦', count: nodes.length },
        { key: 'groups' as const, label: '策略组', emoji: '📋', count: groups.length },
        { key: 'rules' as const, label: '规则', emoji: '📐', count: rules.length },
    ];

    const editorFooter = (
        <div className="px-5 py-4 bg-white border-t border-gray-100 flex-shrink-0">
            <div className="flex justify-between items-center bg-gray-50/80 px-5 py-3 border border-gray-200/60 rounded-xl shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                    {tab === 'nodes' && (hasNodeChanges ? <span className="text-amber-600 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> 有未保存的节点更改</span> : '所有节点已保存')}
                    {tab === 'groups' && (hasGroupChanges ? <span className="text-amber-600 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> 有未保存的策略组更改</span> : '所有策略组已保存')}
                    {tab === 'rules' && (hasRuleChanges ? <span className="text-blue-600 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> 有未保存的分流规则更改</span> : '所有规则已保存')}
                </div>
                {tab === 'nodes' && (
                    <button onClick={handleSaveNodes} disabled={!hasNodeChanges || savingNodes} className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 transition-all flex items-center gap-2">
                        {savingNodes ? '保存中...' : '💾 保存节点配置'}
                    </button>
                )}
                {tab === 'groups' && (
                    <button onClick={handleSaveGroups} disabled={!hasGroupChanges || savingGroups} className="px-6 py-2 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 transition-all flex items-center gap-2">
                        {savingGroups ? '保存中...' : '💾 保存策略组配置'}
                    </button>
                )}
                {tab === 'rules' && (
                    <button onClick={handleSaveRules} disabled={!hasRuleChanges || savingRules} className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 transition-all flex items-center gap-2">
                        {savingRules ? '保存中...' : '💾 保存规则配置'}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={open}
            title={`编辑配置 — ${sourceName}`}
            onClose={onClose}
            maxWidth="max-w-3xl"
            footer={!loading && editorFooter}
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                    <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-sm">加载中...</span>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                        {tabs.map(t => (
                            <button
                                key={t.key} onClick={() => setTab(t.key)}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
                            >
                                <span>{t.emoji} {t.label}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>
                            </button>
                        ))}
                    </div>

                    {tab === 'nodes' && (
                        <div className="flex flex-col gap-4">
                            <NodeInputPanel
                                onAddManualNode={handleAddManualNode}
                                onParseLinks={(text) => handlePreviewImport(text, 'links')}
                                onParseConfig={(text) => handlePreviewImport(text, 'config')}
                                onError={error}
                                hideLinksInput={!!importPreview}
                                hideConfigInput={!!importPreview}
                            />
                            {importPreview && (
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-blue-800">🔍 解析预览</h4>
                                        <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <label className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${importOptions.nodes ? 'bg-white border-blue-200' : 'bg-white/50 border-transparent opacity-60'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={importOptions.nodes} onChange={e => setImportOptions(prev => ({ ...prev, nodes: e.target.checked }))} />
                                                <span className="font-bold text-sm">代理节点 ({importPreview.proxies.length})</span>
                                            </div>
                                            {importOptions.nodes && (
                                                <select className="text-xs p-1 border rounded" value={importOptions.nodeMode} onChange={e => setImportOptions(prev => ({ ...prev, nodeMode: e.target.value as any }))}>
                                                    <option value="append">新增模式</option><option value="overwrite">覆盖模式</option>
                                                </select>
                                            )}
                                        </label>
                                        <label className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${importOptions.groups ? 'bg-white border-blue-200' : 'bg-white/50 border-transparent opacity-60'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={importOptions.groups} onChange={e => setImportOptions(prev => ({ ...prev, groups: e.target.checked }))} />
                                                <span className="font-bold text-sm">策略组 ({importPreview.groups.length})</span>
                                            </div>
                                            {importOptions.groups && (
                                                <select className="text-xs p-1 border rounded" value={importOptions.groupMode} onChange={e => setImportOptions(prev => ({ ...prev, groupMode: e.target.value as any }))}>
                                                    <option value="append">新增模式</option><option value="overwrite">覆盖模式</option>
                                                </select>
                                            )}
                                        </label>
                                        <label className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${importOptions.rules ? 'bg-white border-blue-200' : 'bg-white/50 border-transparent opacity-60'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={importOptions.rules} onChange={e => setImportOptions(prev => ({ ...prev, rules: e.target.checked }))} />
                                                <span className="font-bold text-sm">分流规则 ({importPreview.rules.length})</span>
                                            </div>
                                            {importOptions.rules && (
                                                <select className="text-xs p-1 border rounded" value={importOptions.ruleMode} onChange={e => setImportOptions(prev => ({ ...prev, ruleMode: e.target.value as any }))}>
                                                    <option value="append">新增模式</option><option value="overwrite">覆盖模式</option>
                                                </select>
                                            )}
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleConfirmImport} disabled={isImporting} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">
                                            {isImporting ? '导入中...' : '确认导入所选内容'}
                                        </button>
                                        <button onClick={() => setImportPreview(null)} disabled={isImporting} className="px-6 py-2 border bg-white rounded-xl font-medium text-gray-600 hover:bg-gray-50">取消</button>
                                    </div>
                                </div>
                            )}

                            {nodes.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <input type="text" value={nodeSearch} onChange={e => setNodeSearch(e.target.value)} placeholder="搜索节点..." className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                                        {selectedNodeIds.size > 0 && (
                                            <button onClick={handleDeleteSelectedNodes} disabled={deletingNodes} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg shrink-0">
                                                删选中的 {selectedNodeIds.size} 项
                                            </button>
                                        )}
                                    </div>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={filteredNodes.length > 0 && selectedNodeIds.size === filteredNodes.length} onChange={() => setSelectedNodeIds(selectedNodeIds.size === filteredNodes.length && filteredNodes.length > 0 ? new Set() : new Set(filteredNodes.map(n => n.id)))} className="cursor-pointer" />
                                                <span className="text-xs font-semibold text-gray-500">节点列表</span>
                                            </div>
                                            <span className="text-xs text-gray-400">{filteredNodes.length} / {nodes.length} 个节点</span>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                                            {filteredNodes.length === 0 ? <div className="py-8 text-center text-gray-400 text-sm">无匹配节点</div> : filteredNodes.map(node => (
                                                <div key={node.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 group">
                                                    <div className="flex items-center gap-3">
                                                        <input type="checkbox" checked={selectedNodeIds.has(node.id)} onChange={() => { const s = new Set(selectedNodeIds); s.has(node.id) ? s.delete(node.id) : s.add(node.id); setSelectedNodeIds(s); }} className="cursor-pointer" />
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${PROTOCOL_COLORS[node.type] || 'bg-gray-100 text-gray-600'}`}>{node.type}</span>
                                                        <span className="text-sm font-medium text-gray-700">{node.name}</span>
                                                        <span className="text-xs text-gray-400 font-mono hidden sm:block">{node.server}:{node.port}</span>
                                                    </div>
                                                    <button onClick={() => handleDeleteNode(node.id, node.name)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'groups' && (
                        <div className="relative">
                            {savingGroups && <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl font-bold text-gray-600"><div className="w-5 h-5 border-2 border-green-500 border-t-green-200 rounded-full animate-spin mr-2" /> 保存中...</div>}
                            <GroupEditor value={groupsText} onChange={handleGroupsTextChange} proxies={memoizedProxies} />
                        </div>
                    )}

                    {tab === 'rules' && (
                        <div className="relative">
                            {savingRules && <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl font-bold text-gray-600"><div className="w-5 h-5 border-2 border-blue-500 border-t-blue-200 rounded-full animate-spin mr-2" /> 保存中...</div>}
                            <RuleEditor value={rulesText} onChange={handleRulesTextChange} proxyGroups={memoizedGroups} />
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
