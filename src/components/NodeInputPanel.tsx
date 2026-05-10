'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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

export default function NodeInputPanel({
    onAddManualNode,
    onParseLinks,
    onParseConfig,
    onError,
    hideLinksInput = false,
    hideConfigInput = false,
}: NodeInputPanelProps) {
    const t = useTranslations('common.nodeInput');
    const tConst = useTranslations('common.constants');
    const [nodeTab, setNodeTab] = useState<'links' | 'manual' | 'config'>('links');
    const [animKey, setAnimKey] = useState(0);

    const NODE_INPUT_TABS = [
        { key: 'links' as const, label: t('tabs.links') },
        { key: 'manual' as const, label: t('tabs.manual') },
        { key: 'config' as const, label: t('tabs.config') },
    ];

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

    const passwordLabelKey = getPasswordLabel(protocol);
    const passwordPlaceholderKey = getPasswordPlaceholder(protocol);
    const passwordLabel = passwordLabelKey.startsWith('constants.') ? tConst(passwordLabelKey.replace('constants.', '')) : passwordLabelKey;
    const passwordPlaceholder = passwordPlaceholderKey.startsWith('constants.') ? tConst(passwordPlaceholderKey.replace('constants.', '')) : passwordPlaceholderKey;

    // --- Handlers ---

    const handleParseLinks = async () => {
        const text = linksText.trim();
        if (!text) {
            onError(t('errors.enterLinks'));
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
            onError(t('errors.enterConfig'));
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
            onError(t('errors.fillRequired'));
            return;
        }
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            onError(t('errors.invalidPort'));
            return;
        }
        const { config, error } = buildNodeConfig(
            protocol, name.trim(), server.trim(), portNum, password, extra
        );
        if (error) {
            // Translate error key from constants
            const translatedError = error.startsWith('constants.') ? tConst(error.replace('constants.', '')) : error;
            onError(translatedError);
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

    const inputClass = 'w-full px-3 py-2 border border-border-strong rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-card transition placeholder:text-text-quaternary';
    const monoInputClass = `${inputClass} font-mono`;
    const textareaClass = 'w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm font-mono resize-y outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-muted transition placeholder:text-text-quaternary';
    const btnClass = 'self-start px-4 py-2 text-sm font-medium rounded-lg bg-accent-button hover:bg-accent-button-hover text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2';

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
            <div ref={tabBarRef} className="relative flex gap-1 p-1 bg-muted border border-border-strong rounded-lg w-fit">
                {/* Sliding indicator */}
                <div
                    className="absolute top-1 bottom-1 rounded-md bg-card shadow-sm border border-border-strong transition-all duration-250 ease-out pointer-events-none z-0"
                    style={{ left: indicator.left, width: indicator.width }}
                />
                {NODE_INPUT_TABS.map(tab => (
                    <button
                        key={tab.key}
                        ref={el => { if (el) tabRefs.current.set(tab.key, el); }}
                        onClick={() => handleTabChange(tab.key)}
                        className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 ${nodeTab === tab.key
                            ? 'text-blue-600'
                            : 'text-text-tertiary hover:text-text-secondary'
                            }`}
                    >
                        {tab.label}
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
                            placeholder={t('linksPlaceholder')}
                            rows={4}
                            className={textareaClass}
                        />
                        <button onClick={handleParseLinks} disabled={linksParsing} className={btnClass}>
                            {linksParsing ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('parsing')}
                                </>
                            ) : t('parseLinks')}
                        </button>
                    </div>
                )}

                {/* Manual form */}
                {nodeTab === 'manual' && (
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-text-secondary">{t('protocol')}</label>
                                <select
                                    value={protocol}
                                    onChange={e => setProtocol(e.target.value)}
                                    className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-card transition"
                                >
                                    {PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-text-secondary">{t('nodeName')} <span className="text-red-400">*</span></label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} className={inputClass} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 flex flex-col gap-1">
                                <label className="text-xs font-medium text-text-secondary">{t('serverAddress')} <span className="text-red-400">*</span></label>
                                <input type="text" value={server} onChange={e => setServer(e.target.value)} placeholder="example.com" className={monoInputClass} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-text-secondary">{t('port')} <span className="text-red-400">*</span></label>
                                <input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="443" className={monoInputClass} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-text-secondary">{passwordLabel}</label>
                            <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder={passwordPlaceholder} className={monoInputClass} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-text-tertiary">{t('extraConfig')} <span className="font-normal">({t('optional')}, JSON)</span></label>
                            <textarea
                                value={extra}
                                onChange={e => setExtra(e.target.value)}
                                placeholder='{"tls": true, "network": "ws"}'
                                rows={2}
                                className={textareaClass}
                            />
                        </div>
                        <button onClick={handleManualSubmit} disabled={manualSubmitting} className={btnClass}>
                            {manualSubmitting ? t('adding') : t('addNode')}
                        </button>
                    </div>
                )}

                {/* Config import */}
                {nodeTab === 'config' && !hideConfigInput && (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={configText}
                            onChange={e => setConfigText(e.target.value)}
                            placeholder={t('configPlaceholder')}
                            rows={4}
                            className={textareaClass}
                        />
                        <button onClick={handleParseConfig} disabled={configParsing} className={btnClass}>
                            {configParsing ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('parsing')}
                                </>
                            ) : t('parseConfig')}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
