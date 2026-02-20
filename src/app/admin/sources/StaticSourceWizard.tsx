'use client';

import { useState, useCallback, useEffect } from 'react';
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

let nextId = 0;
const genId = () => `tmp_${++nextId}_${Date.now()}`;

interface StaticSourceWizardContentProps {
    initialName?: string;
    existingNames: string[];
    onSuccess: () => void;
    onCancel: () => void;
}

export function StaticSourceWizardContent({ initialName = '', existingNames, onSuccess, onCancel }: StaticSourceWizardContentProps) {
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

    const stepTitles = ['命名', '添加节点', '策略组', '分流规则'];

    return (
        <div className="space-y-4">
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
                {stepTitles.map((title, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 600,
                            background: i <= step ? '#3b82f6' : '#e5e7eb',
                            color: i <= step ? '#fff' : '#9ca3af',
                            transition: 'all 0.2s',
                        }}>
                            {i < step ? '✓' : i + 1}
                        </div>
                        <span style={{
                            fontSize: '13px', color: i <= step ? '#1f2937' : '#9ca3af',
                            fontWeight: i === step ? 600 : 400,
                        }}>{title}</span>
                        {i < stepTitles.length - 1 && (
                            <span style={{ color: '#d1d5db', margin: '0 4px' }}>→</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Step 0: Name */}
            {step === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                            上游源名称 <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={sourceName}
                            onChange={e => setSourceName(e.target.value)}
                            placeholder="例：我的节点集"
                            onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                            style={{
                                width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                                borderRadius: '8px', fontSize: '14px', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            autoFocus
                        />
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            名称创建后不可修改，用于标识该上游源
                        </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={handleClose} style={{
                            padding: '8px 20px', border: '1px solid #d1d5db', borderRadius: '8px',
                            background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '14px',
                        }}>取消</button>
                        <button onClick={handleNameNext} style={{
                            padding: '8px 20px', border: 'none', borderRadius: '8px',
                            background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '14px',
                            fontWeight: 500,
                        }}>下一步</button>
                    </div>
                </div>
            )}

            {/* Step 1: Nodes */}
            {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Input method tabs */}
                    <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
                        {([
                            { key: 'links', label: '🔗 分享链接' },
                            { key: 'manual', label: '✏️ 手动填写' },
                            { key: 'config', label: '📄 配置导入' },
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setNodeTab(tab.key)} style={{
                                padding: '6px 14px', border: 'none', cursor: 'pointer',
                                fontSize: '13px', fontWeight: nodeTab === tab.key ? 500 : 400,
                                color: nodeTab === tab.key ? '#1d4ed8' : '#4b5563',
                                background: nodeTab === tab.key ? '#fff' : 'transparent',
                                borderRadius: '6px',
                                boxShadow: nodeTab === tab.key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.15s',
                            }}>{tab.label}</button>
                        ))}
                    </div>

                    {/* Links input */}
                    {nodeTab === 'links' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                                value={linksText}
                                onChange={e => setLinksText(e.target.value)}
                                placeholder={'粘贴分享链接，每行一个：\nvmess://...\nss://...\nvless://...\ntrojan://...\nhysteria2://...\n\n也支持 Base64 编码的订阅内容'}
                                rows={6}
                                style={{
                                    width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                                    borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace',
                                    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                            <button onClick={handleParseLinks} disabled={linksParsing} style={{
                                padding: '8px 16px', border: 'none', borderRadius: '8px',
                                background: linksParsing ? '#93c5fd' : '#3b82f6', color: '#fff',
                                cursor: linksParsing ? 'not-allowed' : 'pointer', fontSize: '14px',
                                alignSelf: 'flex-start',
                            }}>{linksParsing ? '解析中...' : '解析链接'}</button>
                        </div>
                    )}

                    {/* Manual form */}
                    {nodeTab === 'manual' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>协议</label>
                                    <select value={manualProtocol} onChange={e => setManualProtocol(e.target.value)} style={{
                                        width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                                        borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}>
                                        {PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>节点名称 *</label>
                                    <input type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                                        placeholder="例：香港-1" style={{
                                            width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                                            borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                        }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>服务器地址 *</label>
                                    <input type="text" value={manualServer} onChange={e => setManualServer(e.target.value)}
                                        placeholder="example.com" style={{
                                            width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                                            borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                        }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>端口 *</label>
                                    <input type="number" value={manualPort} onChange={e => setManualPort(e.target.value)}
                                        placeholder="443" style={{
                                            width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                                            borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                        }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>{passwordLabel}</label>
                                <input type="text" value={manualPassword} onChange={e => setManualPassword(e.target.value)}
                                    placeholder={['vmess', 'vless'].includes(manualProtocol) ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : '密码'}
                                    style={{
                                        width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                                        borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace',
                                        outline: 'none', boxSizing: 'border-box',
                                    }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#6b7280' }}>
                                    附加配置 <span style={{ fontWeight: 400 }}>(可选, JSON 格式)</span>
                                </label>
                                <textarea value={manualExtra} onChange={e => setManualExtra(e.target.value)}
                                    placeholder='{"tls": true, "network": "ws", "ws-opts": {"path": "/ws"}}'
                                    rows={2} style={{
                                        width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                                        borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace',
                                        resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                                    }} />
                            </div>
                            <button onClick={handleAddManualNode} style={{
                                padding: '8px 16px', border: 'none', borderRadius: '8px',
                                background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '14px',
                                alignSelf: 'flex-start',
                            }}>添加节点</button>
                        </div>
                    )}

                    {/* Config import */}
                    {nodeTab === 'config' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                                value={configText}
                                onChange={e => setConfigText(e.target.value)}
                                placeholder={'粘贴 Clash / Clash Meta YAML 配置文件内容\n\n将自动解析其中的节点、策略组和分流规则'}
                                rows={8}
                                style={{
                                    width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                                    borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace',
                                    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                            <button onClick={handleParseConfig} disabled={configParsing} style={{
                                padding: '8px 16px', border: 'none', borderRadius: '8px',
                                background: configParsing ? '#93c5fd' : '#3b82f6', color: '#fff',
                                cursor: configParsing ? 'not-allowed' : 'pointer', fontSize: '14px',
                                alignSelf: 'flex-start',
                            }}>{configParsing ? '解析中...' : '解析配置'}</button>
                        </div>
                    )}

                    {/* Node list */}
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                            已添加节点 ({nodes.length})
                        </div>
                        {nodes.length === 0 ? (
                            <div style={{
                                padding: '24px', textAlign: 'center', color: '#9ca3af',
                                border: '2px dashed #e5e7eb', borderRadius: '8px', fontSize: '14px',
                            }}>
                                暂无节点，请通过上方方式添加
                            </div>
                        ) : (
                            <div style={{
                                maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                            }}>
                                {nodes.map(node => (
                                    <div key={node.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 12px', borderBottom: '1px solid #f3f4f6',
                                        fontSize: '13px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                            <span style={{
                                                padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                                                fontWeight: 600, background: '#dbeafe', color: '#1d4ed8',
                                                flexShrink: 0,
                                            }}>{node.type}</span>
                                            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
                                            <span style={{ color: '#9ca3af', fontSize: '12px', flexShrink: 0 }}>{node.server}:{node.port}</span>
                                        </div>
                                        <button onClick={() => handleRemoveNode(node.id)} style={{
                                            border: 'none', background: 'none', color: '#ef4444',
                                            cursor: 'pointer', fontSize: '16px', padding: '2px 4px', flexShrink: 0,
                                        }}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <button onClick={() => initialName ? handleClose() : setStep(0)} style={{
                            padding: '8px 20px', border: '1px solid #d1d5db', borderRadius: '8px',
                            background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '14px',
                        }}>{initialName ? '取消' : '上一步'}</button>
                        <button onClick={handleNodesNext} style={{
                            padding: '8px 20px', border: 'none', borderRadius: '8px',
                            background: nodes.length > 0 ? '#3b82f6' : '#93c5fd',
                            color: '#fff', cursor: nodes.length > 0 ? 'pointer' : 'not-allowed',
                            fontSize: '14px', fontWeight: 500,
                        }}>下一步</button>
                    </div>
                </div>
            )}

            {/* Step 2: Proxy Groups */}
            {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                        策略组用于组织节点。系统会自动创建一个默认策略组包含所有节点。你也可以通过编辑器或手动添加更多。
                    </p>

                    <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '2px' }}>
                        <GroupEditor
                            value={groupsText}
                            onChange={setGroupsText}
                            proxies={nodes.map(n => ({ id: n.id, name: n.name, type: n.type, source: sourceName }))}
                        />
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '12px' }}>
                        <button onClick={() => setStep(1)} style={{
                            padding: '8px 20px', border: '1px solid #d1d5db', borderRadius: '8px',
                            background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '14px',
                        }}>上一步</button>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setStep(3)} style={{
                                padding: '8px 20px', border: 'none', borderRadius: '8px',
                                background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '14px',
                                fontWeight: 500,
                            }}>下一步</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Rules */}
            {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                        分流规则决定流量如何路由。每行一条规则，格式如：DOMAIN-SUFFIX,google.com,PROXY。你可以通过编辑器管理。
                    </p>

                    <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '2px' }}>
                        <RuleEditor
                            value={rulesText}
                            onChange={setRulesText}
                            proxyGroups={(yaml.load(groupsText) as any[] || []).map(g => ({ name: g.name, type: g.type, source: sourceName }))}
                        />
                    </div>

                    {/* Summary & Save */}
                    <div style={{
                        padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: '8px', fontSize: '13px', color: '#475569',
                    }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>📊 创建摘要</div>
                        <div>名称: <strong>{sourceName.trim()}</strong></div>
                        <div>节点: <strong>{nodes.length}</strong> 个</div>
                        <div>策略组: <strong>{(yaml.load(groupsText) as any[] || []).length}</strong> 个</div>
                        <div>规则: <strong>{rulesText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length}</strong> 条</div>
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <button onClick={() => setStep(2)} style={{
                            padding: '8px 20px', border: '1px solid #d1d5db', borderRadius: '8px',
                            background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '14px',
                        }}>上一步</button>
                        <button onClick={handleSave} disabled={saving} style={{
                            padding: '8px 24px', border: 'none', borderRadius: '8px',
                            background: saving ? '#86efac' : '#22c55e', color: '#fff',
                            cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px',
                            fontWeight: 600,
                        }}>{saving ? '创建中...' : '✓ 完成创建'}</button>
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
