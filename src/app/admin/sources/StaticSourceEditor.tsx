'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import GroupEditor from '@/components/GroupEditor';
import RuleEditor from '@/components/RuleEditor';
import yaml from 'js-yaml';
import {
    getStaticSourceData,
    addNodesToStaticSource,
    deleteStaticSourceNode,
    deleteStaticSourceNodes,
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

const PROTOCOLS = [
    { value: 'vmess', label: 'VMess' },
    { value: 'vless', label: 'VLESS' },
    { value: 'trojan', label: 'Trojan' },
    { value: 'ss', label: 'Shadowsocks' },
    { value: 'hysteria2', label: 'Hysteria2' },
];

const PROTOCOL_COLORS: Record<string, string> = {
    vmess: 'bg-blue-100 text-blue-700',
    vless: 'bg-violet-100 text-violet-700',
    trojan: 'bg-red-100 text-red-700',
    ss: 'bg-green-100 text-green-700',
    hysteria2: 'bg-orange-100 text-orange-700',
};

export default function StaticSourceEditor({ sourceName, open, onClose, onUpdate, defaultTab = 'nodes' }: StaticSourceEditorProps) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    const [tab, setTab] = useState<'nodes' | 'groups' | 'rules'>(defaultTab);
    const [loading, setLoading] = useState(true);
    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [groups, setGroups] = useState<GroupData[]>([]);
    const [rules, setRules] = useState<RuleData[]>([]);

    // Node input tab: 'manual' | 'links' | 'config'
    const [nodeTab, setNodeTab] = useState<'manual' | 'links' | 'config'>('links');

    // Add node form - Links
    const [addLinksText, setAddLinksText] = useState('');
    const [addLinksParsing, setAddLinksParsing] = useState(false);

    // Add node form - Manual
    const [manualProtocol, setManualProtocol] = useState('vmess');
    const [manualName, setManualName] = useState('');
    const [manualServer, setManualServer] = useState('');
    const [manualPort, setManualPort] = useState('');
    const [manualPassword, setManualPassword] = useState('');
    const [manualExtra, setManualExtra] = useState('');
    const [manualAdding, setManualAdding] = useState(false);

    // Add node form - Config
    const [configText, setConfigText] = useState('');
    const [configParsing, setConfigParsing] = useState(false);

    // Group/Rule text state for editors
    const [groupsText, setGroupsText] = useState('');
    const [rulesText, setRulesText] = useState('');

    const [savingGroups, setSavingGroups] = useState(false);
    const [savingRules, setSavingRules] = useState(false);

    // Node selection & search
    const [nodeSearch, setNodeSearch] = useState('');
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [deletingNodes, setDeletingNodes] = useState(false);

    // Import flow state
    const [importPreview, setImportPreview] = useState<{
        proxies: any[],
        groups: any[],
        rules: string[]
    } | null>(null);
    const [importOptions, setImportOptions] = useState({
        nodes: true,
        groups: false,
        rules: false,
        nodeMode: 'append' as 'append' | 'overwrite',
        groupMode: 'append' as 'append' | 'overwrite',
        ruleMode: 'append' as 'append' | 'overwrite'
    });
    const [isImporting, setIsImporting] = useState(false);
    const [importSourceTab, setImportSourceTab] = useState<'links' | 'config'>('links');

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
                name: g.name,
                type: g.type,
                proxies: g.proxies
            })));
            setGroupsText(groupYaml);

            const ruleData = result.rules as RuleData[];
            setRules(ruleData);
            setRulesText(ruleData.map(r => r.ruleText).join('\n'));
        } catch (e) {
            error('加载数据失败: ' + String(e));
        }
        setLoading(false);
    }, [sourceName, error]);

    useEffect(() => {
        if (open) {
            loadData();
            if (defaultTab) {
                setTab(defaultTab);
            }
        }
    }, [open, loadData, defaultTab]);

    // === Nodes ===
    const handlePreviewImport = async (text: string, type: 'links' | 'config') => {
        const content = text.trim();
        if (!content) { error('请输入分享链接或配置内容'); return; }

        if (type === 'links') setAddLinksParsing(true);
        else setConfigParsing(true);
        setImportSourceTab(type);

        try {
            const preview = await previewParseContent(content);
            if (preview.proxies.length === 0 && preview.groups.length === 0 && preview.rules.length === 0) {
                error('未能解析到任何有效数据');
            } else {
                setImportPreview(preview);
                // Smart defaults: if groups/rules exist, maybe user wants them
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

        if (type === 'links') setAddLinksParsing(false);
        else setConfigParsing(false);
    };

    const handleConfirmImport = async () => {
        if (!importPreview) return;
        setIsImporting(true);
        try {
            const result = await importStaticSourceData(sourceName, {
                nodes: importPreview.proxies.map((p: any) => ({
                    name: p.name, type: p.type,
                    server: p.server || p.config?.server,
                    port: p.port || p.config?.port,
                    config: p.config || p,
                })),
                groups: importPreview.groups,
                rules: importPreview.rules
            }, {
                importNodes: importOptions.nodes,
                importGroups: importOptions.groups,
                importRules: importOptions.rules,
                nodeMode: importOptions.nodeMode,
                groupMode: importOptions.groupMode,
                ruleMode: importOptions.ruleMode
            });

            if ('error' in result) {
                error(result.error!);
            } else {
                success('配置导入成功');
                setImportPreview(null);
                setAddLinksText('');
                setConfigText('');
                loadData();
                onUpdate();
            }
        } catch (e) {
            error('导入失败: ' + String(e));
        }
        setIsImporting(false);
    };

    const handleCancelImport = () => {
        setImportPreview(null);
    };

    const handleAddManualNode = async () => {
        if (!manualName.trim() || !manualServer.trim() || !manualPort.trim()) { error('请填写节点名称、服务器地址和端口'); return; }
        const port = parseInt(manualPort);
        if (isNaN(port) || port < 1 || port > 65535) { error('端口号无效'); return; }
        const config: any = { name: manualName.trim(), type: manualProtocol, server: manualServer.trim(), port };
        if (['vmess', 'vless'].includes(manualProtocol)) config.uuid = manualPassword;
        else config.password = manualPassword;
        if (manualExtra.trim()) {
            try { Object.assign(config, JSON.parse(manualExtra)); }
            catch { error('附加配置不是有效的 JSON'); return; }
        }
        setManualAdding(true);
        try {
            const result = await addNodesToStaticSource(sourceName, [{ name: config.name, type: config.type, server: config.server, port: config.port, config }]);
            if ('error' in result) { error(result.error!); }
            else { success(`已添加节点: ${config.name}`); setManualName(''); setManualServer(''); setManualPort(''); setManualPassword(''); setManualExtra(''); loadData(); onUpdate(); }
        } catch (e) { error('添加失败: ' + String(e)); }
        setManualAdding(false);
    };

    const handleParseConfig = async () => {
        await handlePreviewImport(configText, 'config');
    };

    const handleDeleteNode = async (nodeId: string, nodeName: string) => {
        const ok = await confirm(`确定删除节点 "${nodeName}" 吗？`, { title: '删除节点', confirmColor: 'red' });
        if (!ok) return;
        try {
            const result = await deleteStaticSourceNode(sourceName, nodeId);
            if ('error' in result) { error(result.error!); }
            else {
                success('节点已删除'); setNodes(prev => prev.filter(n => n.id !== nodeId)); setSelectedNodeIds(prev => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                }); onUpdate();
            }
        } catch (e) { error('删除失败: ' + String(e)); }
    };

    const handleDeleteSelectedNodes = async () => {
        if (selectedNodeIds.size === 0) return;
        const count = selectedNodeIds.size;
        const ok = await confirm(`确定删除选中的 ${count} 个节点吗？`, { title: '批量删除节点', confirmColor: 'red' });
        if (!ok) return;

        setDeletingNodes(true);
        try {
            const result = await deleteStaticSourceNodes(sourceName, Array.from(selectedNodeIds));
            if ('error' in result) { error(result.error!); }
            else {
                success(`已删除 ${count} 个节点`);
                setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
                setSelectedNodeIds(new Set());
                onUpdate();
            }
        } catch (e) { error('批量删除失败: ' + String(e)); }
        setDeletingNodes(false);
    };

    const toggleSelectNode = (id: string) => {
        setSelectedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredNodes = nodes.filter(n =>
        n.name.toLowerCase().includes(nodeSearch.toLowerCase()) ||
        n.server.toLowerCase().includes(nodeSearch.toLowerCase()) ||
        n.type.toLowerCase().includes(nodeSearch.toLowerCase())
    );

    const toggleSelectAll = () => {
        if (selectedNodeIds.size === filteredNodes.length && filteredNodes.length > 0) {
            setSelectedNodeIds(new Set());
        } else {
            setSelectedNodeIds(new Set(filteredNodes.map(n => n.id)));
        }
    };

    // === Groups ===
    const handleSaveGroups = async () => {
        if (!groupsText.trim()) { error('请输入策略组内容'); return; }
        setSavingGroups(true);
        try {
            const parsed = yaml.load(groupsText) as any;
            const parsedArray = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            if (parsedArray.length === 0) { error('至少保留一个策略组'); setSavingGroups(false); return; }
            const result = await saveStaticSourceGroups(sourceName, parsedArray.map((g: any) => ({ name: g.name, type: g.type, proxies: g.proxies || [] })));
            if ('error' in result) { error(result.error!); }
            else { success('策略组已保存'); loadData(); onUpdate(); }
        } catch (e) { error('保存失败: 检查 YAML 格式 (' + String(e) + ')'); }
        setSavingGroups(false);
    };

    // === Rules ===
    const handleSaveRules = async () => {
        setSavingRules(true);
        try {
            const lines = rulesText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.replace(/^-\s*/, '').trim());
            const result = await saveStaticSourceRules(sourceName, lines);
            if ('error' in result) { error(result.error!); }
            else { success('规则已保存'); loadData(); onUpdate(); }
        } catch (e) { error('保存失败: ' + String(e)); }
        setSavingRules(false);
    };

    const passwordLabel = ['vmess', 'vless'].includes(manualProtocol) ? 'UUID' : '密码';

    const tabs = [
        { key: 'nodes' as const, label: '节点', emoji: '📦', count: nodes.length },
        { key: 'groups' as const, label: '策略组', emoji: '📋', count: groups.length },
        { key: 'rules' as const, label: '规则', emoji: '📐', count: rules.length },
    ];

    const nodeInputTabs = [
        { key: 'links' as const, label: '🔗 分享链接' },
        { key: 'manual' as const, label: '✏️ 手动填写' },
        { key: 'config' as const, label: '📄 配置导入' },
    ];

    return (
        <Modal isOpen={open} title={`编辑静态上游源 — ${sourceName}`} onClose={onClose} maxWidth="max-w-2xl">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-sm">加载中...</span>
                </div>
            ) : (
                <div className="flex flex-col gap-0">
                    {/* Tab bar */}
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${tab === t.key
                                    ? 'bg-white text-gray-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                                    }`}
                            >
                                <span>{t.emoji}</span>
                                <span>{t.label}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
                                    }`}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* === Nodes Tab === */}
                    {tab === 'nodes' && (
                        <div className="flex flex-col gap-4">
                            {/* Input method tabs */}
                            <div className="flex gap-1 p-1 bg-gray-50 border border-gray-200 rounded-lg w-fit">
                                {nodeInputTabs.map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setNodeTab(t.key)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${nodeTab === t.key
                                            ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Links input */}
                            {nodeTab === 'links' && !importPreview && (
                                <div className="flex flex-col gap-2">
                                    <textarea
                                        value={addLinksText}
                                        onChange={e => setAddLinksText(e.target.value)}
                                        placeholder={'粘贴分享链接、Base64\nvmess://...\nss://...'}
                                        rows={3}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono resize-y outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-400"
                                    />
                                    <button
                                        onClick={() => handlePreviewImport(addLinksText, 'links')}
                                        disabled={addLinksParsing}
                                        className="self-start px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {addLinksParsing ? '解析中...' : '解析配置'}
                                    </button>
                                </div>
                            )}

                            {/* Manual input */}
                            {nodeTab === 'manual' && (
                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-600">协议</label>
                                            <select
                                                value={manualProtocol}
                                                onChange={e => setManualProtocol(e.target.value)}
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition"
                                            >
                                                {PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-600">节点名称 <span className="text-red-400">*</span></label>
                                            <input
                                                type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                                                placeholder="例：香港-1"
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition placeholder:text-gray-400"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2 flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-600">服务器地址 <span className="text-red-400">*</span></label>
                                            <input
                                                type="text" value={manualServer} onChange={e => setManualServer(e.target.value)}
                                                placeholder="example.com"
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition placeholder:text-gray-400"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-600">端口 <span className="text-red-400">*</span></label>
                                            <input
                                                type="number" value={manualPort} onChange={e => setManualPort(e.target.value)}
                                                placeholder="443"
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition placeholder:text-gray-400"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-600">{passwordLabel}</label>
                                        <input
                                            type="text" value={manualPassword} onChange={e => setManualPassword(e.target.value)}
                                            placeholder={['vmess', 'vless'].includes(manualProtocol) ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : '密码'}
                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition placeholder:text-gray-400"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">附加配置 <span className="font-normal">(可选, JSON)</span></label>
                                        <textarea
                                            value={manualExtra} onChange={e => setManualExtra(e.target.value)}
                                            placeholder='{"tls": true, "network": "ws"}'
                                            rows={2}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-y outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-400"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddManualNode}
                                        disabled={manualAdding}
                                        className="self-start px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {manualAdding ? '添加中...' : '添加节点'}
                                    </button>
                                </div>
                            )}

                            {/* Config input */}
                            {nodeTab === 'config' && !importPreview && (
                                <div className="flex flex-col gap-2">
                                    <textarea
                                        value={configText}
                                        onChange={e => setConfigText(e.target.value)}
                                        placeholder={'粘贴 Clash / Clash Meta YAML 配置文件内容\n\n导入后可选择是否同时导入策略组和规则。'}
                                        rows={4}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono resize-y outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-400"
                                    />
                                    <button
                                        onClick={handleParseConfig}
                                        disabled={configParsing}
                                        className="self-start px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {configParsing ? '解析中...' : '解析并导入配置'}
                                    </button>
                                </div>
                            )}

                            {/* Import Preview & Options Panel */}
                            {importPreview && (
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                            🔍 解析结果预览
                                        </h4>
                                        <button onClick={handleCancelImport} className="text-gray-400 hover:text-gray-600 transition">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {/* Nodes Option */}
                                        <div className={`p-3 rounded-xl border transition-all ${importOptions.nodes ? 'bg-white border-blue-200 shadow-sm' : 'bg-white/50 border-transparent text-gray-400'}`}>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={importOptions.nodes}
                                                    onChange={e => setImportOptions(prev => ({ ...prev, nodes: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-xs font-bold uppercase tracking-wider">代理节点</span>
                                            </label>
                                            <div className="mt-1 text-lg font-mono font-bold text-gray-700 ml-6">
                                                {importPreview.proxies.length} <span className="text-[10px] font-normal text-gray-400 uppercase">项</span>
                                            </div>
                                            {importOptions.nodes && (
                                                <div className="mt-3 ml-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">导入模式</span>
                                                    <div className="flex bg-gray-100 p-0.5 rounded-lg w-full">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); setImportOptions(prev => ({ ...prev, nodeMode: 'append' })); }}
                                                            className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all ${importOptions.nodeMode === 'append' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                            新增
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); setImportOptions(prev => ({ ...prev, nodeMode: 'overwrite' })); }}
                                                            className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all ${importOptions.nodeMode === 'overwrite' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            覆盖
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Groups Option */}
                                        <div className={`p-3 rounded-xl border transition-all ${importOptions.groups ? 'bg-white border-blue-200 shadow-sm' : 'bg-white/50 border-transparent text-gray-400'}`}>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={importOptions.groups}
                                                    onChange={e => setImportOptions(prev => ({ ...prev, groups: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-xs font-bold uppercase tracking-wider">策略组</span>
                                            </label>
                                            <div className="mt-1 text-lg font-mono font-bold text-gray-700 ml-6">
                                                {importPreview.groups.length} <span className="text-[10px] font-normal text-gray-400 uppercase">项</span>
                                            </div>
                                            {importOptions.groups && (
                                                <div className="mt-3 ml-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">导入模式</span>
                                                    <div className="flex bg-gray-100 p-0.5 rounded-lg w-full">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); setImportOptions(prev => ({ ...prev, groupMode: 'append' })); }}
                                                            className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all ${importOptions.groupMode === 'append' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                            新增
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); setImportOptions(prev => ({ ...prev, groupMode: 'overwrite' })); }}
                                                            className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all ${importOptions.groupMode === 'overwrite' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            覆盖
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Rules Option */}
                                        <div className={`p-3 rounded-xl border transition-all ${importOptions.rules ? 'bg-white border-blue-200 shadow-sm' : 'bg-white/50 border-transparent text-gray-400'}`}>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={importOptions.rules}
                                                    onChange={e => setImportOptions(prev => ({ ...prev, rules: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-xs font-bold uppercase tracking-wider">分流规则</span>
                                            </label>
                                            <div className="mt-1 text-lg font-mono font-bold text-gray-700 ml-6">
                                                {importPreview.rules.length} <span className="text-[10px] font-normal text-gray-400 uppercase">项</span>
                                            </div>
                                            {importOptions.rules && (
                                                <div className="mt-3 ml-6 flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">导入模式</span>
                                                    <div className="flex bg-gray-100 p-0.5 rounded-lg w-full">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); setImportOptions(prev => ({ ...prev, ruleMode: 'append' })); }}
                                                            className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all ${importOptions.ruleMode === 'append' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                            新增
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); setImportOptions(prev => ({ ...prev, ruleMode: 'overwrite' })); }}
                                                            className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-md transition-all ${importOptions.ruleMode === 'overwrite' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            覆盖
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleConfirmImport}
                                            disabled={isImporting || (!importOptions.nodes && !importOptions.groups && !importOptions.rules)}
                                            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-md shadow-blue-200 flex items-center justify-center gap-2"
                                        >
                                            {isImporting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    导入中...
                                                </>
                                            ) : '确认导入所选内容'}
                                        </button>
                                        <button
                                            onClick={handleCancelImport}
                                            disabled={isImporting}
                                            className="px-4 py-2.5 text-sm font-bold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition"
                                        >
                                            取消
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Node list */}
                            {nodes.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </span>
                                            <input
                                                type="text"
                                                value={nodeSearch}
                                                onChange={e => setNodeSearch(e.target.value)}
                                                placeholder="搜索节点名称、地址或协议..."
                                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition bg-white"
                                            />
                                        </div>
                                        {selectedNodeIds.size > 0 && (
                                            <button
                                                onClick={handleDeleteSelectedNodes}
                                                disabled={deletingNodes}
                                                className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                                            >
                                                {deletingNodes ? (
                                                    <div className="w-3 h-3 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                )}
                                                删除选中的 {selectedNodeIds.size} 项
                                            </button>
                                        )}
                                    </div>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredNodes.length > 0 && selectedNodeIds.size === filteredNodes.length}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">节点列表</span>
                                            </div>
                                            <span className="text-xs text-gray-400">{filteredNodes.length} / {nodes.length} 个节点</span>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                                            {filteredNodes.length === 0 ? (
                                                <div className="py-8 text-center text-gray-400 text-sm italic">
                                                    未找到匹配的节点
                                                </div>
                                            ) : (
                                                filteredNodes.map(node => (
                                                    <div key={node.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors group">
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedNodeIds.has(node.id)}
                                                                onChange={() => toggleSelectNode(node.id)}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${PROTOCOL_COLORS[node.type] || 'bg-gray-100 text-gray-600'}`}>
                                                                {node.type}
                                                            </span>
                                                            <span className="text-sm font-medium text-gray-700 truncate">{node.name}</span>
                                                            <span className="text-[11px] text-gray-400 shrink-0 font-mono hidden sm:inline">{node.server}:{node.port}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteNode(node.id, node.name);
                                                            }}
                                                            className="shrink-0 ml-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title="删除节点"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {nodes.length === 0 && (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed border-gray-100 rounded-2xl text-gray-300">
                                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-1">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium">暂无节点，请从上方添加</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === Groups Tab === */}
                    <div className={`flex flex-col gap-4 relative ${tab !== 'groups' ? 'hidden' : ''}`}>
                        {savingGroups && (
                            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl animate-in fade-in duration-200">
                                <div className="flex flex-col items-center gap-2 px-6 py-4 bg-white shadow-xl border border-gray-100 rounded-2xl">
                                    <div className="w-6 h-6 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
                                    <span className="text-sm font-bold text-gray-600">正在保存策略组...</span>
                                </div>
                            </div>
                        )}
                        <GroupEditor
                            value={groupsText}
                            onChange={setGroupsText}
                            proxies={memoizedProxies}
                        />
                        <div className="flex justify-end pt-2 border-t border-gray-100">
                            <button
                                onClick={handleSaveGroups}
                                disabled={savingGroups}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {savingGroups ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        保存中...
                                    </>
                                ) : '💾 保存所有策略组'}
                            </button>
                        </div>
                    </div>

                    {/* === Rules Tab === */}
                    <div className={`flex flex-col gap-4 relative ${tab !== 'rules' ? 'hidden' : ''}`}>
                        {savingRules && (
                            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl animate-in fade-in duration-200">
                                <div className="flex flex-col items-center gap-2 px-6 py-4 bg-white shadow-xl border border-gray-100 rounded-2xl">
                                    <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                                    <span className="text-sm font-bold text-gray-600">正在保存规则...</span>
                                </div>
                            </div>
                        )}
                        <RuleEditor
                            value={rulesText}
                            onChange={setRulesText}
                            proxyGroups={memoizedGroups}
                        />
                        <div className="flex justify-end pt-2 border-t border-gray-100">
                            <button
                                onClick={handleSaveRules}
                                disabled={savingRules}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {savingRules ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        保存中...
                                    </>
                                ) : '💾 保存所有规则'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
