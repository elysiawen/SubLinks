'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { useTranslations } from 'next-intl';
import { nanoid } from 'nanoid';

interface UpstreamSource {
    name: string;
    url?: string;
}

export default function RefreshApiModal({
    isOpen,
    onClose,
    currentApiKey,
    sources,
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    currentApiKey?: string;
    sources: UpstreamSource[];
    onSave: (apiKey: string | null) => Promise<{ success: boolean }>;
}) {
    const t = useTranslations('admin.refreshApiModal');
    const { success, error } = useToast();
    const [apiKey, setApiKey] = useState(currentApiKey || '');
    const [loading, setLoading] = useState(false);
    const [showUsage, setShowUsage] = useState(false);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    const generateKey = () => {
        setApiKey(nanoid(32));
    };

    const handleSave = async () => {
        setLoading(true);
        const result = await onSave(apiKey || null);
        setLoading(false);

        if (result.success) {
            success(t('saved'));
            onClose();
        } else {
            error(t('saveFailed'));
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={t('title')}>
                <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* API Key Configuration */}
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">
                            {t('apiKeyLabel')}
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="flex-1 border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono text-sm break-all"
                                placeholder={t('apiKeyPlaceholder')}
                            />
                            <button
                                onClick={generateKey}
                                className="px-4 py-2 bg-border-strong text-text-primary rounded-lg hover:bg-muted transition-colors font-medium whitespace-nowrap"
                            >
                                {t('generate')}
                            </button>
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                            {t('apiKeyHint')}
                        </p>
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-2 pb-4">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                        >
                            {loading ? t('saving') : t('saveConfig')}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium"
                        >
                            {t('close')}
                        </button>
                    </div>

                    {/* View Usage Button */}
                    {apiKey && (
                        <div className="pt-4 border-t">
                            <button
                                onClick={() => setShowUsage(true)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                <span>📖</span>
                                <span>{t('viewUsage')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Usage Modal */}
            {showUsage && (
                <UsageModal
                    isOpen={showUsage}
                    onClose={() => setShowUsage(false)}
                    apiKey={apiKey}
                    baseUrl={baseUrl}
                    sources={sources}
                />
            )}
        </>
    );
}


// Code Block Component
function CodeBlock({ title, code }: { title: string; code: string }) {
    const t = useTranslations('admin.refreshApiModal');
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-muted rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-border-strong">
                <span className="text-xs text-text-secondary font-medium">{title}</span>
                <button
                    onClick={handleCopy}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-muted"
                >
                    {copied ? t('copied') : t('copy')}
                </button>
            </div>
            <pre className="px-4 py-3 text-xs text-text-primary overflow-x-auto">
                <code>{code}</code>
            </pre>
        </div>
    );
}

// Usage Modal Component
function UsageModal({
    isOpen,
    onClose,
    apiKey,
    baseUrl,
    sources
}: {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
    baseUrl: string;
    sources: any[];
}) {
    const t = useTranslations('admin.refreshApiModal');
    const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
    const [selectedSource, setSelectedSource] = useState<string>(sources[0]?.name || '');
    const [precache, setPrecache] = useState(true);
    const [method, setMethod] = useState<'get' | 'post' | 'bearer'>('get');


    // Generate URL based on selections
    const generateUrl = () => {
        const sources = selectedSource === '' ? [] : selectedSource.split(',').filter(s => s);
        const isMultiple = sources.length > 1;
        const isSingle = sources.length === 1;

        if (method === 'get') {
            const params = new URLSearchParams();
            params.append('key', apiKey);
            if (isSingle) {
                params.append('sourceName', sources[0]);
            } else if (isMultiple) {
                params.append('sourceNames', sources.join(','));
            }
            if (precache) params.append('precache', 'true');
            return `${baseUrl}/api/sources/refresh?${params.toString()}`;
        } else if (method === 'post') {
            let sourceParam = '';
            if (isSingle) {
                sourceParam = `,"sourceName":"${sources[0]}"`;
            } else if (isMultiple) {
                sourceParam = `,"sourceNames":${JSON.stringify(sources)}`;
            }
            return `curl -X POST ${baseUrl}/api/sources/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"key":"${apiKey}"${sourceParam}${precache ? ',"precache":true' : ''}}'`;
        } else {
            const params = new URLSearchParams();
            if (isSingle) {
                params.append('sourceName', sources[0]);
            } else if (isMultiple) {
                params.append('sourceNames', sources.join(','));
            }
            if (precache) params.append('precache', 'true');
            return `curl "${baseUrl}/api/sources/refresh${params.toString() ? '?' + params.toString() : ''}" \\
  -H "Authorization: Bearer ${apiKey}"`;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('usageTitle')} maxWidth="max-w-4xl">
            <div className="space-y-6">
                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                        onClick={() => setMode('simple')}
                        className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${mode === 'simple'
                            ? 'bg-card text-accent-foreground shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                            }`}
                    >
                        {t('simpleMode')}
                    </button>
                    <button
                        onClick={() => setMode('advanced')}
                        className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${mode === 'advanced'
                            ? 'bg-card text-accent-foreground shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                            }`}
                    >
                        {t('advancedMode')}
                    </button>
                </div>

                {mode === 'simple' ? (
                    /* Simple Mode */
                    <div className="space-y-4">
                        {/* Source Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-2">
                                {t('selectSource')}
                            </label>
                            <div className="border border-border-input rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="all-sources"
                                        checked={selectedSource === ''}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedSource('');
                                            }
                                        }}
                                        className="w-4 h-4 text-accent-foreground rounded focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <label htmlFor="all-sources" className="text-sm text-text-secondary font-medium">
                                        {t('allSources')}
                                    </label>
                                </div>
                                {sources.map((source) => (
                                    <div key={source.name} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id={`source-${source.name}`}
                                            checked={selectedSource.split(',').includes(source.name)}
                                            onChange={(e) => {
                                                const currentSources = selectedSource === '' ? [] : selectedSource.split(',').filter(s => s);
                                                if (e.target.checked) {
                                                    setSelectedSource([...currentSources, source.name].join(','));
                                                } else {
                                                    setSelectedSource(currentSources.filter(s => s !== source.name).join(','));
                                                }
                                            }}
                                            className="w-4 h-4 text-accent-foreground rounded focus:ring-2 focus:ring-blue-500/20"
                                        />
                                        <label htmlFor={`source-${source.name}`} className="text-sm text-text-secondary">
                                            {source.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Precache Option */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="precache"
                                checked={precache}
                                onChange={(e) => setPrecache(e.target.checked)}
                                className="w-4 h-4 text-accent-foreground rounded focus:ring-2 focus:ring-blue-500/20"
                            />
                            <label htmlFor="precache" className="text-sm text-text-secondary">
                                {t('precache')}
                            </label>
                        </div>

                        {/* Method Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-2">
                                {t('requestMethod')}
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMethod('get')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${method === 'get'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-muted text-text-secondary hover:bg-border-strong'
                                        }`}
                                >
                                    GET
                                </button>
                                <button
                                    onClick={() => setMethod('post')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${method === 'post'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-muted text-text-secondary hover:bg-border-strong'
                                        }`}
                                >
                                    POST
                                </button>
                                <button
                                    onClick={() => setMethod('bearer')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${method === 'bearer'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-muted text-text-secondary hover:bg-border-strong'
                                        }`}
                                >
                                    Bearer
                                </button>
                            </div>
                        </div>

                        {/* Generated Link */}
                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-2">
                                {t('generatedLink')}
                            </label>
                            <CodeBlock
                                title={method === 'get' ? t('directLink') : t('curlCommand')}
                                code={generateUrl()}
                            />
                        </div>
                    </div>
                ) : (
                    /* Advanced Mode */
                    <div className="space-y-6">
                        {/* API Info */}
                        <div className="bg-accent border border-blue-200 rounded-lg p-4">
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="font-semibold text-text-secondary">{t('apiKeyLabel2')}</span>
                                    <code className="ml-2 bg-card px-2 py-1 rounded border text-xs break-all">{apiKey}</code>
                                </div>
                                <div>
                                    <span className="font-semibold text-text-secondary">{t('baseUrlLabel')}</span>
                                    <span className="ml-2 text-text-secondary">{baseUrl}</span>
                                </div>
                            </div>
                        </div>

                        {/* Method 1: GET */}
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary mb-3">{t('method1Get')}</h3>
                            <div className="space-y-3">
                                <CodeBlock
                                    title={t('refreshSingle')}
                                    code={`curl "${baseUrl}/api/sources/refresh?key=${apiKey}&sourceName=${sources[0]?.name || 'main'}&precache=true"`}
                                />
                                <CodeBlock
                                    title={t('refreshMultiple')}
                                    code={`curl "${baseUrl}/api/sources/refresh?key=${apiKey}&sourceNames=${sources.slice(0, 2).map(s => s.name).join(',') || 'source1,source2'}"`}
                                />
                                <CodeBlock
                                    title={t('refreshAll')}
                                    code={`curl "${baseUrl}/api/sources/refresh?key=${apiKey}&precache=true"`}
                                />
                            </div>
                        </div>

                        {/* Method 2: POST */}
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary mb-3">{t('method2Post')}</h3>
                            <CodeBlock
                                title={t('refreshSpecified')}
                                code={`curl -X POST ${baseUrl}/api/sources/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"key":"${apiKey}","sourceName":"${sources[0]?.name || 'main'}","precache":true}'`}
                            />
                        </div>

                        {/* Method 3: Bearer */}
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary mb-3">{t('method3Bearer')}</h3>
                            <CodeBlock
                                title={t('useBearer')}
                                code={`curl "${baseUrl}/api/sources/refresh?sourceName=${sources[0]?.name || 'main'}" \\
  -H "Authorization: Bearer ${apiKey}"`}
                            />
                        </div>

                        {/* Parameters Table */}
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary mb-3">{t('paramDesc')}</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm border border-border-strong rounded-lg">
                                    <thead className="bg-surface">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold border-b">{t('paramName')}</th>
                                            <th className="px-4 py-2 text-left font-semibold border-b">{t('paramType')}</th>
                                            <th className="px-4 py-2 text-left font-semibold border-b">{t('paramDetail')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-muted">key</td>
                                            <td className="px-4 py-2">string</td>
                                            <td className="px-4 py-2">{t('paramKey')}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-muted">sourceName</td>
                                            <td className="px-4 py-2">string</td>
                                            <td className="px-4 py-2">{t('paramSourceName')}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-muted">sourceNames</td>
                                            <td className="px-4 py-2">string[]</td>
                                            <td className="px-4 py-2">{t('paramSourceNames')}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-muted">precache</td>
                                            <td className="px-4 py-2">boolean</td>
                                            <td className="px-4 py-2">{t('paramPrecache')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
