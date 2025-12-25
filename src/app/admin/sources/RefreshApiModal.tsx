'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { nanoid } from 'nanoid';

interface UpstreamSource {
    name: string;
    url: string;
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
        <Modal isOpen={isOpen} onClose={onClose} title="刷新API配置">
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                {/* API Key Configuration */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        API密钥
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono text-sm"
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
                <div className="flex gap-2 pb-4 border-b">
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

                {/* Usage Examples */}
                {apiKey && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            📖 使用方法
                        </h3>

                        {/* Method 1: GET */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">方式1：GET 请求</h4>
                            <div className="space-y-2">
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
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">方式2：POST 请求</h4>
                            <CodeBlock
                                title="刷新指定源"
                                code={`curl -X POST ${baseUrl}/api/sources/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"key":"${apiKey}","sourceName":"${sources[0]?.name || 'GitHub主源'}","precache":true}'`}
                            />
                        </div>

                        {/* Method 3: Bearer */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">方式3：Bearer Token</h4>
                            <CodeBlock
                                title="使用Bearer认证"
                                code={`curl "${baseUrl}/api/sources/refresh?sourceName=${sources[0]?.name || 'GitHub主源'}" \\
  -H "Authorization: Bearer ${apiKey}"`}
                            />
                        </div>

                        {/* Parameters Table */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">参数说明</h4>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold border-b">参数</th>
                                            <th className="px-3 py-2 text-left font-semibold border-b">类型</th>
                                            <th className="px-3 py-2 text-left font-semibold border-b">说明</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        <tr>
                                            <td className="px-3 py-2 font-mono text-xs bg-gray-50">key</td>
                                            <td className="px-3 py-2">string</td>
                                            <td className="px-3 py-2">API密钥（Bearer方式除外）</td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-mono text-xs bg-gray-50">sourceName</td>
                                            <td className="px-3 py-2">string</td>
                                            <td className="px-3 py-2">单个上游源名称</td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-mono text-xs bg-gray-50">sourceNames</td>
                                            <td className="px-3 py-2">string[]</td>
                                            <td className="px-3 py-2">多个上游源（逗号分隔或数组）</td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-mono text-xs bg-gray-50">precache</td>
                                            <td className="px-3 py-2">boolean</td>
                                            <td className="px-3 py-2">是否自动预缓存订阅</td>
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
