'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PROTOCOLS, getPasswordLabel, getPasswordPlaceholder, buildNodeConfig } from '@/lib/constants';

export interface ManualNodeConfig {
    name: string;
    type: string;
    server: string;
    port: number;
    config: any;
}

interface NodeInputPanelProps {
    /** Called when user submits a manual node */
    onAddManualNode: (node: ManualNodeConfig) => void | Promise<void>;
    /** Called when user clicks parse on links text */
    onParseLinks: (text: string) => Promise<void>;
    /** Called when user clicks parse on config text */
    onParseConfig: (text: string) => Promise<void>;
    /** Called on validation errors */
    onError: (message: string) => void;
    /** Whether links input should be hidden (e.g. during import preview) */
    hideLinksInput?: boolean;
    /** Whether config input should be hidden (e.g. during import preview) */
    hideConfigInput?: boolean;
}

const NODE_INPUT_TABS = [
    { key: 'links' as const, label: '🔗 链接' },
    { key: 'manual' as const, label: '✏️ 手动' },
    { key: 'config' as const, label: '📄 配置' },
];

export default function NodeInputPanel({
    onAddManualNode,
    onParseLinks,
    onParseConfig,
    onError,
    hideLinksInput = false,
    hideConfigInput = false,
}: NodeInputPanelProps) {
    const [nodeTab, setNodeTab] = useState<'links' | 'manual' | 'config'>('links');
    const [animKey, setAnimKey] = useState(0);

    // Sliding indicator
    const tabBarRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const [indicator, setIndicator] = useState({ left: 0, width: 0 });

    const updateIndicator = useCallback(() => {
        const btn = tabRefs.current.get(nodeTab);
        const bar = tabBarRef.current;
        if (btn && bar) {
            const barRect = bar.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            setIndicator({
                left: btnRect.left - barRect.left,
                width: btnRect.width,
            });
        }
    }, [nodeTab]);

    useEffect(() => {
        updateIndicator();
    }, [updateIndicator]);

    const handleTabChange = (key: 'links' | 'manual' | 'config') => {
        if (key !== nodeTab) {
            setNodeTab(key);
            setAnimKey(k => k + 1);
        }
    };

    // Links state
    const [linksText, setLinksText] = useState('');
    const [linksParsing, setLinksParsing] = useState(false);

    // Config state
    const [configText, setConfigText] = useState('');
    const [configParsing, setConfigParsing] = useState(false);

    // Manual form state
    const [protocol, setProtocol] = useState('vmess');
    const [name, setName] = useState('');
    const [server, setServer] = useState('');
    const [port, setPort] = useState('');
    const [password, setPassword] = useState('');
    const [extra, setExtra] = useState('');
    const [manualSubmitting, setManualSubmitting] = useState(false);

    const passwordLabel = getPasswordLabel(protocol);
    const passwordPlaceholder = getPasswordPlaceholder(protocol);

    // --- Handlers ---

    const handleParseLinks = async () => {
        const text = linksText.trim();
        if (!text) {
            onError('请输入分享链接');
            return;
        }
        setLinksParsing(true);
        try {
            await onParseLinks(text);
            setLinksText('');
        } finally {
            setLinksParsing(false);
        }
    };

    const handleParseConfig = async () => {
        const text = configText.trim();
        if (!text) {
            onError('请输入配置内容');
            return;
        }
        setConfigParsing(true);
        try {
            await onParseConfig(text);
            setConfigText('');
        } finally {
            setConfigParsing(false);
        }
    };

    const handleManualSubmit = async () => {
        if (!name.trim() || !server.trim() || !port.trim()) {
            onError('请填写节点名称、服务器地址和端口');
            return;
        }
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            onError('端口号无效');
            return;
        }
        const { config, error } = buildNodeConfig(
            protocol, name.trim(), server.trim(), portNum, password, extra
        );
        if (error) {
            onError(error);
            return;
        }
        setManualSubmitting(true);
        try {
            await onAddManualNode({
                name: config.name,
                type: config.type,
                server: config.server,
                port: config.port,
                config,
            });
            setName('');
            setServer('');
            setPort('');
            setPassword('');
            setExtra('');
        } finally {
            setManualSubmitting(false);
        }
    };

    const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition placeholder:text-gray-400';
    const monoInputClass = `${inputClass} font-mono`;
    const textareaClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono resize-y outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-400';
    const btnClass = 'self-start px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2';

    return (
        <>
            {/* Tab animation styles */}
            <style>{`
                @keyframes nodeTabFadeIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .node-tab-enter {
                    animation: nodeTabFadeIn 0.2s ease-out both;
                }
            `}</style>

            {/* Input method tabs with sliding indicator */}
            <div ref={tabBarRef} className="relative flex gap-1 p-1 bg-gray-50 border border-gray-200 rounded-lg w-fit">
                {/* Sliding indicator */}
                <div
                    className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm border border-gray-200 transition-all duration-250 ease-out pointer-events-none z-0"
                    style={{ left: indicator.left, width: indicator.width }}
                />
                {NODE_INPUT_TABS.map(t => (
                    <button
                        key={t.key}
                        ref={el => { if (el) tabRefs.current.set(t.key, el); }}
                        onClick={() => handleTabChange(t.key)}
                        className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 ${nodeTab === t.key
                            ? 'text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content with fade-in animation */}
            <div key={animKey} className="node-tab-enter">
                {/* Links input */}
                {nodeTab === 'links' && !hideLinksInput && (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={linksText}
                            onChange={e => setLinksText(e.target.value)}
                            placeholder={'粘贴分享链接，每行一个：\nvmess://...\nss://...\nvless://...\ntrojan://...\nhysteria2://...\n\n也支持 Base64 编码的订阅内容'}
                            rows={4}
                            className={textareaClass}
                        />
                        <button onClick={handleParseLinks} disabled={linksParsing} className={btnClass}>
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
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">协议</label>
                                <select
                                    value={protocol}
                                    onChange={e => setProtocol(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition"
                                >
                                    {PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">节点名称 <span className="text-red-400">*</span></label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例：香港-1" className={inputClass} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">服务器地址 <span className="text-red-400">*</span></label>
                                <input type="text" value={server} onChange={e => setServer(e.target.value)} placeholder="example.com" className={monoInputClass} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">端口 <span className="text-red-400">*</span></label>
                                <input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="443" className={monoInputClass} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">{passwordLabel}</label>
                            <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder={passwordPlaceholder} className={monoInputClass} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-500">附加配置 <span className="font-normal">(可选, JSON)</span></label>
                            <textarea
                                value={extra}
                                onChange={e => setExtra(e.target.value)}
                                placeholder='{"tls": true, "network": "ws"}'
                                rows={2}
                                className={textareaClass}
                            />
                        </div>
                        <button onClick={handleManualSubmit} disabled={manualSubmitting} className={btnClass}>
                            {manualSubmitting ? '添加中...' : '添加节点'}
                        </button>
                    </div>
                )}

                {/* Config import */}
                {nodeTab === 'config' && !hideConfigInput && (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={configText}
                            onChange={e => setConfigText(e.target.value)}
                            placeholder={'粘贴 Clash / Clash Meta YAML 配置文件内容\n\n将自动解析其中的节点、策略组和分流规则'}
                            rows={4}
                            className={textareaClass}
                        />
                        <button onClick={handleParseConfig} disabled={configParsing} className={btnClass}>
                            {configParsing ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    解析中...
                                </>
                            ) : '解析配置'}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
