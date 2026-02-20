'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
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
            success('API密钥已保存');
            onClose();
        } else {
            error('保存失败');
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="刷新API配置">
                <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* API Key Configuration */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            API密钥
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono text-sm break-all"
                                placeholder="输入API密钥或点击生成"
                            />
                            <button
                                onClick={generateKey}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium whitespace-nowrap"
                            >
                                随机生成
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            用于验证刷新请求的密钥，建议使用32位随机字符串
                        </p>
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-2 pb-4">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                        >
                            {loading ? '保存中...' : '保存配置'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            关闭
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
                                <span>查看使用方法</span>
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
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                <span className="text-xs text-gray-300 font-medium">{title}</span>
                <button
                    onClick={handleCopy}
                    className="text-xs text-gray-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                >
                    {copied ? '✓ 已复制' : '📋 复制'}
                </button>
            </div>
            <pre className="px-4 py-3 text-xs text-gray-100 overflow-x-auto">
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
        <Modal isOpen={isOpen} onClose={onClose} title="📖 API使用方法" maxWidth="max-w-4xl">
            <div className="space-y-6">
                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    <button
                        onClick={() => setMode('simple')}
                        className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${mode === 'simple'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        🎯 简易模式
                    </button>
                    <button
                        onClick={() => setMode('advanced')}
                        className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${mode === 'advanced'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        🔧 完整文档
                    </button>
                </div>

                {mode === 'simple' ? (
                    /* Simple Mode */
                    <div className="space-y-4">
                        {/* Source Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                选择上游源
                            </label>
                            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
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
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <label htmlFor="all-sources" className="text-sm text-gray-700 font-medium">
                                        全部源
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
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500/20"
                                        />
                                        <label htmlFor={`source-${source.name}`} className="text-sm text-gray-700">
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
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500/20"
                            />
                            <label htmlFor="precache" className="text-sm text-gray-700">
                                自动预缓存订阅
                            </label>
                        </div>

                        {/* Method Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                请求方式
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMethod('get')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${method === 'get'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    GET
                                </button>
                                <button
                                    onClick={() => setMethod('post')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${method === 'post'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    POST
                                </button>
                                <button
                                    onClick={() => setMethod('bearer')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${method === 'bearer'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Bearer
                                </button>
                            </div>
                        </div>

                        {/* Generated Link */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                生成的链接
                            </label>
                            <CodeBlock
                                title={method === 'get' ? '直接访问链接' : 'cURL 命令'}
                                code={generateUrl()}
                            />
                        </div>
                    </div>
                ) : (
                    /* Advanced Mode */
                    <div className="space-y-6">
                        {/* API Info */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="font-semibold text-gray-700">API密钥：</span>
                                    <code className="ml-2 bg-white px-2 py-1 rounded border text-xs break-all">{apiKey}</code>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-700">基础URL：</span>
                                    <span className="ml-2 text-gray-600">{baseUrl}</span>
                                </div>
                            </div>
                        </div>

                        {/* Method 1: GET */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">方式1：GET 请求</h3>
                            <div className="space-y-3">
                                <CodeBlock
                                    title="刷新单个源"
                                    code={`curl "${baseUrl}/api/sources/refresh?key=${apiKey}&sourceName=${sources[0]?.name || 'GitHub主源'}&precache=true"`}
                                />
                                <CodeBlock
                                    title="刷新多个源"
                                    code={`curl "${baseUrl}/api/sources/refresh?key=${apiKey}&sourceNames=${sources.slice(0, 2).map(s => s.name).join(',') || 'GitHub主源,Cloudflare备份'}"`}
                                />
                                <CodeBlock
                                    title="刷新全部源"
                                    code={`curl "${baseUrl}/api/sources/refresh?key=${apiKey}&precache=true"`}
                                />
                            </div>
                        </div>

                        {/* Method 2: POST */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">方式2：POST 请求</h3>
                            <CodeBlock
                                title="刷新指定源"
                                code={`curl -X POST ${baseUrl}/api/sources/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"key":"${apiKey}","sourceName":"${sources[0]?.name || 'GitHub主源'}","precache":true}'`}
                            />
                        </div>

                        {/* Method 3: Bearer */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">方式3：Bearer Token</h3>
                            <CodeBlock
                                title="使用Bearer认证"
                                code={`curl "${baseUrl}/api/sources/refresh?sourceName=${sources[0]?.name || 'GitHub主源'}" \\
  -H "Authorization: Bearer ${apiKey}"`}
                            />
                        </div>

                        {/* Parameters Table */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">参数说明</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold border-b">参数</th>
                                            <th className="px-4 py-2 text-left font-semibold border-b">类型</th>
                                            <th className="px-4 py-2 text-left font-semibold border-b">说明</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-gray-50">key</td>
                                            <td className="px-4 py-2">string</td>
                                            <td className="px-4 py-2">API密钥（Bearer方式除外）</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-gray-50">sourceName</td>
                                            <td className="px-4 py-2">string</td>
                                            <td className="px-4 py-2">单个上游源名称</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-gray-50">sourceNames</td>
                                            <td className="px-4 py-2">string[]</td>
                                            <td className="px-4 py-2">多个上游源（逗号分隔或数组）</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-mono text-xs bg-gray-50">precache</td>
                                            <td className="px-4 py-2">boolean</td>
                                            <td className="px-4 py-2">是否自动预缓存订阅</td>
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
