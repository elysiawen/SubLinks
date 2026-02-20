'use client';

import { useState, useCallback, useEffect, useMemo, Fragment } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import GroupEditor from '@/components/GroupEditor';
import RuleEditor from '@/components/RuleEditor';
import yaml from 'js-yaml';
import { previewParseContent, createStaticSource } from './actions';

// ===== Types =====

interface ParsedNode {
    id: string; // client-side temp ID
    name: string;
    type: string;
    server: string;
    port: number;
    config: any;
}

interface ParsedGroup {
    name: string;
    type: string;
    proxies: string[];
}

interface StaticSourceWizardProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    existingNames: string[];
}

// Protocol form field definitions
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

let nextId = 0;
const genId = () => `tmp_${++nextId}_${Date.now()}`;

interface StaticSourceWizardContentProps {
    initialName?: string;
    onNameChange?: (name: string) => void;
    existingNames: string[];
    onSuccess: () => void;
    onCancel: () => void;
}

export function StaticSourceWizardContent({ initialName = '', onNameChange, existingNames, onSuccess, onCancel }: StaticSourceWizardContentProps) {
    const { success, error } = useToast();

    // Wizard step: 0=name, 1=nodes, 2=groups, 3=rules
    const [step, setStep] = useState(initialName ? 1 : 0);
    const [sourceName, setSourceName] = useState(initialName);
    const [nodes, setNodes] = useState<ParsedNode[]>([]);
    const [groups, setGroups] = useState<ParsedGroup[]>([]);
    const [rules, setRules] = useState<string[]>([]);

    // Editor text states
    const [groupsText, setGroupsText] = useState('');
    const [rulesText, setRulesText] = useState('');

    // Sync sourceName with initialName if it changes from parent
    useEffect(() => {
        setSourceName(initialName);
    }, [initialName]);

    const [saving, setSaving] = useState(false);

    // Node input tab: 'manual' | 'links' | 'config'
    const [nodeTab, setNodeTab] = useState<'manual' | 'links' | 'config'>('links');

    // Manual form state
    const [manualProtocol, setManualProtocol] = useState('vmess');
    const [manualName, setManualName] = useState('');
    const [manualServer, setManualServer] = useState('');
    const [manualPort, setManualPort] = useState('');
    const [manualPassword, setManualPassword] = useState(''); // uuid / password
    const [manualExtra, setManualExtra] = useState(''); // extra JSON fields

    // Links textarea
    const [linksText, setLinksText] = useState('');
    const [linksParsing, setLinksParsing] = useState(false);

    // Config textarea
    const [configText, setConfigText] = useState('');
    const [configParsing, setConfigParsing] = useState(false);

    const resetWizard = () => {
        setStep(initialName ? 1 : 0);
        setSourceName(initialName);
        setNodes([]);
        setGroups([]);
        setRules([]);
        setNodeTab('links');
        setManualName('');
        setManualServer('');
        setManualPort('');
        setManualPassword('');
        setManualExtra('');
        setLinksText('');
        setConfigText('');
        setGroupsText('');
        setRulesText('');
    };

    // Update internal state if initialName changes
    useEffect(() => {
        if (initialName && !sourceName) {
            setSourceName(initialName);
            if (step === 0) setStep(1);
        }
    }, [initialName, sourceName, step]);

    const handleClose = () => {
        resetWizard();
        onCancel();
    };

    // === Step 0: Name ===
    const handleNameNext = () => {
        const name = sourceName.trim();
        if (!name) {
            error('请输入上游源名称');
            return;
        }
        if (existingNames.includes(name)) {
            error('上游源名称已存在');
            return;
        }
        setStep(1);
    };

    // Memoize stable data for editors to prevent flickers
    const stableProxies = useMemo(() =>
        nodes.map(n => ({ id: n.id, name: n.name, type: n.type, source: sourceName })),
        [nodes, sourceName]
    );

    const stableProxyGroups = useMemo(() => {
        try {
            const parsed = yaml.load(groupsText) as any[] || [];
            return parsed.map((g: any) => ({ name: g.name, type: g.type, source: sourceName }));
        } catch (e) {
            return [];
        }
    }, [groupsText, sourceName]);

    // === Step 1: Add Nodes ===

    const handleAddManualNode = () => {
        if (!manualName.trim() || !manualServer.trim() || !manualPort.trim()) {
            error('请填写节点名称、服务器地址和端口');
            return;
        }
        const port = parseInt(manualPort);
        if (isNaN(port) || port < 1 || port > 65535) {
            error('端口号无效');
            return;
        }

        const config: any = {
            name: manualName.trim(),
            type: manualProtocol,
            server: manualServer.trim(),
            port,
        };

        // Add password/uuid based on protocol
        if (['vmess', 'vless'].includes(manualProtocol)) {
            config.uuid = manualPassword;
        } else {
            config.password = manualPassword;
        }

        // Parse extra JSON fields
        if (manualExtra.trim()) {
            try {
                const extra = JSON.parse(manualExtra);
                Object.assign(config, extra);
            } catch {
                error('附加配置不是有效的 JSON');
                return;
            }
        }

        const node: ParsedNode = {
            id: genId(),
            name: config.name,
            type: config.type,
            server: config.server,
            port: config.port,
            config,
        };

        setNodes(prev => [...prev, node]);
        setManualName('');
        setManualServer('');
        setManualPort('');
        setManualPassword('');
        setManualExtra('');
        success(`已添加节点: ${node.name}`);
    };

    const handleParseLinks = useCallback(async () => {
        const text = linksText.trim();
        if (!text) {
            error('请输入分享链接');
            return;
        }
        setLinksParsing(true);
        try {
            const result = await previewParseContent(text);
            if (result.proxies.length === 0) {
                error('未能解析到任何节点，请检查链接格式');
                setLinksParsing(false);
                return;
            }
            const newNodes: ParsedNode[] = result.proxies.map((p: any) => ({
                id: genId(),
                name: p.name,
                type: p.type,
                server: p.server || p.config?.server,
                port: p.port || p.config?.port,
                config: p.config || p,
            }));
            setNodes(prev => [...prev, ...newNodes]);
            setLinksText('');
            success(`已解析 ${newNodes.length} 个节点`);
        } catch (e) {
            error('解析失败: ' + String(e));
        }
        setLinksParsing(false);
    }, [linksText, error, success]);

    const handleParseConfig = useCallback(async () => {
        const text = configText.trim();
        if (!text) {
            error('请输入或粘贴 Clash 配置');
            return;
        }
        setConfigParsing(true);
        try {
            const result = await previewParseContent(text);
            const newNodes: ParsedNode[] = (result.proxies || []).map((p: any) => ({
                id: genId(),
                name: p.name,
                type: p.type,
                server: p.server || p.config?.server,
                port: p.port || p.config?.port,
                config: p.config || p,
            }));
            if (newNodes.length > 0) {
                setNodes(prev => [...prev, ...newNodes]);
            }
            // Import groups and rules from config
            if (result.groups && result.groups.length > 0) {
                const incomingGroups = result.groups.map((g: any) => ({
                    name: g.name,
                    type: g.type,
                    proxies: g.proxies || [],
                }));
                setGroups(prev => [...prev, ...incomingGroups]);

                // Also update groupsText for GroupEditor
                const currentGroups = yaml.load(groupsText) as any[] || [];
                const mergedGroups = [...currentGroups, ...incomingGroups];
                setGroupsText(yaml.dump(mergedGroups));
            }
            if (result.rules && result.rules.length > 0) {
                setRules(prev => [...prev, ...result.rules]);
                // Also update rulesText for RuleEditor
                setRulesText(prev => (prev ? prev + '\n' : '') + result.rules.join('\n'));
            }
            setConfigText('');
            const parts = [];
            if (newNodes.length > 0) parts.push(`${newNodes.length} 个节点`);
            if (result.groups?.length > 0) parts.push(`${result.groups.length} 个策略组`);
            if (result.rules?.length > 0) parts.push(`${result.rules.length} 条规则`);
            success(`已解析: ${parts.join(', ') || '无内容'}`);
        } catch (e) {
            error('解析失败: ' + String(e));
        }
        setConfigParsing(false);
    }, [configText, error, success]);

    const handleRemoveNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
    };

    const handleNodesNext = () => {
        if (nodes.length === 0) {
            error('至少添加一个节点才能继续');
            return;
        }
        // If step 2 is empty, initialize it with a default group
        if (!groupsText.trim()) {
            const defaultGroup = {
                name: 'default',
                type: 'select',
                proxies: [`SOURCE:${sourceName.trim()}`],
            };
            setGroupsText(yaml.dump([defaultGroup]));
        }
        setStep(2);
    };

    // === Save ===
    const handleSave = async () => {
        setSaving(true);
        try {
            // Parse groupsText back to array
            const finalGroupsArr = yaml.load(groupsText) as any[] || [];
            if (finalGroupsArr.length === 0) {
                error('请至少添加一个策略组');
                setSaving(false);
                return;
            }

            // Parse rulesText back to array
            const finalRulesArr = rulesText.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'))
                .map(l => l.replace(/^-\s*/, '').trim());

            const result = await createStaticSource(
                sourceName.trim(),
                nodes.map(n => ({
                    name: n.name,
                    type: n.type,
                    server: n.server,
                    port: n.port,
                    config: n.config,
                })),
                finalGroupsArr,
                finalRulesArr
            );
            if ('error' in result) {
                error(result.error!);
                setSaving(false);
                return;
            }
            success('静态上游源创建成功');
            resetWizard();
            onSuccess();
        } catch (e) {
            error('创建失败: ' + String(e));
        }
        setSaving(false);
    };

    // Protocol-specific password label
    const passwordLabel = ['vmess', 'vless'].includes(manualProtocol) ? 'UUID' : '密码';

    const stepTitles = ['命名', '添加节点', '策略组', '分流规则', '确认'];

    return (
        <div className="space-y-6">
            {/* Step indicator */}
            <div className="flex gap-2 sm:gap-4 mb-8 justify-center items-center">
                {stepTitles.map((title, i) => (
                    <Fragment key={i}>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className={`
                                w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300
                                ${i <= step ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-gray-100 text-gray-400'}
                            `}>
                                {i < step ? '✓' : i + 1}
                            </div>
                            <span className={`
                                text-xs sm:text-sm transition-colors duration-300 whitespace-nowrap
                                ${i === step ? 'text-gray-900 font-bold block' : 'text-gray-400 font-medium hidden md:block'}
                            `}>
                                {title}
                            </span>
                        </div>
                        {i < stepTitles.length - 1 && (
                            <div className={`h-px transition-colors duration-300 ${i < step ? 'bg-blue-200' : 'bg-gray-200'} flex-1 min-w-[1rem] max-w-[2rem] sm:max-w-none sm:w-8`} />
                        )}
                    </Fragment>
                ))}
            </div>

            {/* Step 0: Name */}
            {step === 0 && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">
                            上游源名称 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={sourceName}
                            onChange={(e) => {
                                setSourceName(e.target.value);
                                onNameChange?.(e.target.value);
                            }}
                            placeholder="例如：机场A、备用源"
                            onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all"
                            autoFocus
                        />
                        <p className="text-xs text-gray-400 flex items-center gap-1.5 ml-1">
                            <span>ℹ️</span> 名称创建后不可修改，用于标识该上游源
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={handleClose}
                            className="px-6 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleNameNext}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-semibold text-sm"
                        >
                            下一步
                        </button>
                    </div>
                </div>
            )}

            {/* Step 1: Nodes */}
            <div className={`flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 ${step === 1 ? 'block' : 'hidden'}`}>
                {/* Input method tabs */}
                <div className="flex p-0.5 sm:p-1 bg-gray-100/50 rounded-xl w-fit">
                    {([
                        { key: 'links', label: '🔗 链接' },
                        { key: 'manual', label: '✏️ 手动' },
                        { key: 'config', label: '📄 配置' },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setNodeTab(tab.key)}
                            className={`
                                    px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200
                                    ${nodeTab === tab.key
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'}
                                `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Links input */}
                {nodeTab === 'links' && (
                    <div className="flex flex-col gap-4">
                        <textarea
                            value={linksText}
                            onChange={e => setLinksText(e.target.value)}
                            placeholder={'粘贴分享链接，每行一个：\nvmess://...\nss://...\nvless://...\ntrojan://...\nhysteria2://...\n\n也支持 Base64 编码的订阅内容'}
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                        />
                        <button
                            onClick={handleParseLinks}
                            disabled={linksParsing}
                            className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 transition-all font-bold text-sm self-start flex items-center gap-2"
                        >
                            {linksParsing ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    解析中...
                                </>
                            ) : '解析链接'}
                        </button>
                    </div>
                )}

                {/* Manual form */}
                {nodeTab === 'manual' && (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">协议</label>
                                <select
                                    value={manualProtocol}
                                    onChange={e => setManualProtocol(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                >
                                    {PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">节点名称 *</label>
                                <input
                                    type="text"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    placeholder="例：香港-1"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">服务器地址 *</label>
                                <input
                                    type="text"
                                    value={manualServer}
                                    onChange={e => setManualServer(e.target.value)}
                                    placeholder="example.com"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">端口 *</label>
                                <input
                                    type="number"
                                    value={manualPort}
                                    onChange={e => setManualPort(e.target.value)}
                                    placeholder="443"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{passwordLabel}</label>
                            <input
                                type="text"
                                value={manualPassword}
                                onChange={e => setManualPassword(e.target.value)}
                                placeholder={['vmess', 'vless'].includes(manualProtocol) ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : '密码'}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                                附加配置 <span className="font-normal text-[10px]">(可选, JSON 格式)</span>
                            </label>
                            <textarea
                                value={manualExtra}
                                onChange={e => setManualExtra(e.target.value)}
                                placeholder='{"tls": true, "network": "ws", "ws-opts": {"path": "/ws"}}'
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                            />
                        </div>
                        <button
                            onClick={handleAddManualNode}
                            className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-bold text-sm self-start flex items-center gap-2"
                        >
                            <span>+</span> 添加节点
                        </button>
                    </div>
                )}

                {/* Config import */}
                {nodeTab === 'config' && (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                        <textarea
                            value={configText}
                            onChange={e => setConfigText(e.target.value)}
                            placeholder={'粘贴 Clash / Clash Meta YAML 配置文件内容\n\n将自动解析其中的节点、策略组和分流规则'}
                            rows={8}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                        />
                        <button
                            onClick={handleParseConfig}
                            disabled={configParsing}
                            className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 transition-all font-bold text-sm self-start flex items-center gap-2"
                        >
                            {configParsing ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    解析中...
                                </>
                            ) : '解析配置'}
                        </button>
                    </div>
                )}

                {/* Node list */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-sm font-bold text-gray-700">已添加节点</span>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full ring-1 ring-blue-100">{nodes.length}</span>
                    </div>
                    {nodes.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-100 rounded-2xl text-gray-300">
                            <div className="p-3 bg-gray-50 rounded-full">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium">暂无节点，请从上方添加</span>
                        </div>
                    ) : (
                        <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-gray-200/50 divide-y divide-gray-50">
                            {nodes.map(node => (
                                <div key={node.id} className="group flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`
                                                shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider
                                                ${PROTOCOL_COLORS[node.type] || 'bg-gray-100 text-gray-600'}
                                            `}>
                                            {node.type}
                                        </span>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[13px] font-bold text-gray-700 truncate">{node.name}</span>
                                            <span className="text-[10px] text-gray-400 font-mono tracking-tight">{node.server}:{node.port}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveNode(node.id)}
                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="移除节点"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between gap-3 sm:gap-4 pt-4 border-t border-gray-50">
                    <button
                        onClick={() => initialName ? handleClose() : setStep(0)}
                        className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm"
                    >
                        {initialName ? '取消' : '上一步'}
                    </button>
                    <button
                        onClick={handleNodesNext}
                        className={`
                                flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-white transition-all font-bold text-sm
                                ${nodes.length > 0
                                ? 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200'
                                : 'bg-gray-200 cursor-not-allowed'}
                            `}
                    >
                        下一步
                    </button>
                </div>
            </div>

            {/* Step 2: Proxy Groups */}
            <div className={`flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 ${step === 2 ? 'block' : 'hidden'}`}>
                <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-xl border border-gray-200/50 leading-relaxed">
                    <span className="font-bold text-gray-600 italic mr-1">TIPS:</span>
                    策略组用于组织节点。系统会自动创建一个默认策略组包含所有节点。你也可以通过编辑器或手动添加更多。
                </p>

                <div className="max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    <GroupEditor
                        value={groupsText}
                        onChange={setGroupsText}
                        proxies={stableProxies}
                    />
                </div>

                {/* Navigation */}
                <div className="flex justify-between gap-4 pt-4 border-t border-gray-50">
                    <button
                        onClick={() => setStep(1)}
                        className="px-6 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm"
                    >
                        上一步
                    </button>
                    <button
                        onClick={() => setStep(3)}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all font-bold text-sm"
                    >
                        下一步
                    </button>
                </div>
            </div>

            {/* Step 3: Rules */}
            <div className={`flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 ${step === 3 ? 'block' : 'hidden'}`}>
                <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-xl border border-gray-200/50 leading-relaxed">
                    <span className="font-bold text-gray-600 italic mr-1">TIPS:</span>
                    分流规则决定流量如何路由。每行一条规则，格式如：DOMAIN-SUFFIX,google.com,PROXY。你可以通过编辑器管理。
                </p>

                <div className="max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    <RuleEditor
                        value={rulesText}
                        onChange={setRulesText}
                        proxyGroups={stableProxyGroups}
                    />
                </div>

                {/* Navigation */}
                <div className="flex justify-between gap-4 pt-4 border-t border-gray-50">
                    <button
                        onClick={() => setStep(2)}
                        className="px-6 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm"
                    >
                        上一步
                    </button>
                    <button
                        onClick={() => setStep(4)}
                        className="px-8 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all font-bold text-sm"
                    >
                        下一步
                    </button>
                </div>
            </div>

            {/* Step 4: Confirm */}
            {step === 4 && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                        <h4 className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
                            <span>🔍</span> 最后确认
                        </h4>
                        <p className="text-xs text-blue-600 leading-relaxed">
                            请检查以下配置摘要。点击“完成创建”后，系统将为您生成静态上游源及其关联的策略组和规则。
                        </p>
                    </div>

                    <div className="p-5 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-6">
                        <div className="font-bold text-gray-800 text-xs sm:text-sm flex items-center gap-2 uppercase tracking-wider pb-3 border-b border-gray-50">
                            <span>📊</span> 配置摘要
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-12 animate-in fade-in slide-in-from-top-1 duration-500">
                            <div className="space-y-1.5 group">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                                    上游源名称
                                </div>
                                <div className="text-sm text-gray-800 font-black pl-2.5 border-l-2 border-blue-100 group-hover:border-blue-400 transition-colors">{sourceName.trim()}</div>
                            </div>

                            <div className="space-y-1.5 group">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                                    节点数量
                                </div>
                                <div className="text-sm text-emerald-600 font-black pl-2.5 border-l-2 border-emerald-100 group-hover:border-emerald-400 transition-colors">{nodes.length} <span className="text-[10px] font-medium text-gray-400 ml-1">个已就绪节点</span></div>
                            </div>

                            <div className="space-y-1.5 group">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
                                    策略组配置
                                </div>
                                <div className="text-sm text-indigo-600 font-black pl-2.5 border-l-2 border-indigo-100 group-hover:border-indigo-400 transition-colors">
                                    {(yaml.load(groupsText) as any[] || []).length} <span className="text-[10px] font-medium text-gray-400 ml-1">个可视化分组</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 group">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-purple-400"></span>
                                    路由规则
                                </div>
                                <div className="text-sm text-purple-600 font-black pl-2.5 border-l-2 border-purple-100 group-hover:border-purple-400 transition-colors">
                                    {rulesText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length} <span className="text-[10px] font-medium text-gray-400 ml-1">条分流逻辑</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between gap-4 pt-4 border-t border-gray-50">
                        <button
                            onClick={() => setStep(3)}
                            className="px-6 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm"
                        >
                            上一步
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200 disabled:bg-blue-300 transition-all font-bold text-sm flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    创建中...
                                </>
                            ) : (
                                <>
                                    <span>✓</span> 完成并创建
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StaticSourceWizard({ open, onClose, onSuccess, existingNames }: StaticSourceWizardProps) {
    if (!open) return null;

    return (
        <Modal isOpen={open} title="新增静态上游源" onClose={onClose} maxWidth="max-w-2xl">
            <StaticSourceWizardContent
                existingNames={existingNames}
                onSuccess={onSuccess}
                onCancel={onClose}
            />
        </Modal>
    );
}
