'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import StaticSourceEditor from '../sources/StaticSourceEditor';

export default function AdminProxiesClient({
    proxiesBySource,
    totalCount,
    sourceTypes = {}
}: {
    proxiesBySource: Record<string, any[]>,
    totalCount: number,
    sourceTypes?: Record<string, string>
}) {
    const { success } = useToast();
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [selectedProxyIndex, setSelectedProxyIndex] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [mobileView, setMobileView] = useState<'list' | 'detail'>('list'); // Mobile view state
    const [editingSource, setEditingSource] = useState<string | null>(null);

    const sources = Object.keys(proxiesBySource).sort();
    const currentSourceProxies = selectedSource ? proxiesBySource[selectedSource] : [];

    const filteredProxies = useMemo(() => {
        if (!searchTerm) return currentSourceProxies;
        const lowerTerm = searchTerm.toLowerCase();
        return currentSourceProxies.filter(p =>
            p.name.toLowerCase().includes(lowerTerm) ||
            p.server?.toLowerCase().includes(lowerTerm) ||
            p.type.toLowerCase().includes(lowerTerm)
        );
    }, [currentSourceProxies, searchTerm]);

    const selectedProxy = filteredProxies[selectedProxyIndex] || (filteredProxies.length > 0 ? filteredProxies[0] : null);

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        success(`已复制 ${label}`);
    };

    const handleProxySelect = (idx: number) => {
        setSelectedProxyIndex(idx);
        setMobileView('detail'); // Switch to detail view on mobile
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🌍 节点列表
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{totalCount}</span>
                </h2>
            </div>

            {sources.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无节点数据
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map(source => {
                    const proxies = proxiesBySource[source];
                    const typeCount = proxies.reduce((acc: Record<string, number>, p) => {
                        acc[p.type] = (acc[p.type] || 0) + 1;
                        return acc;
                    }, {});

                    return (
                        <div key={source} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    📡 {source}
                                    {sourceTypes[source] === 'static' && (
                                        <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                            静态
                                        </span>
                                    )}
                                </h3>
                            </div>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">节点数量</span>
                                    <span className="font-semibold text-blue-600">{proxies.length}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {Object.entries(typeCount).map(([type, count]) => (
                                        <span key={type} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {type}: {count}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedSource(source);
                                        setSelectedProxyIndex(0);
                                        setSearchTerm('');
                                        setMobileView('list');
                                    }}
                                    className={`bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm ${sourceTypes[source] === 'static' ? 'flex-1' : 'w-full'}`}
                                >
                                    查看详情
                                </button>
                                {sourceTypes[source] === 'static' && (
                                    <button
                                        onClick={() => setEditingSource(source)}
                                        className="bg-purple-50 text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-100 transition-colors font-medium text-sm flex-1"
                                    >
                                        ⚙️ 管理
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Enhanced Detail Modal */}
            <Modal
                isOpen={!!selectedSource}
                onClose={() => setSelectedSource(null)}
                title={
                    selectedSource ? (
                        <div className="flex items-center gap-2">
                            <span>📡 {selectedSource}</span>
                            <span className="text-sm font-normal text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                                {filteredProxies.length} / {currentSourceProxies.length}
                            </span>
                        </div>
                    ) : ''
                }
                maxWidth="max-w-7xl"
            >
                {selectedSource && (
                    <div className="-m-6 h-[70vh] flex flex-col">
                        {/* Mobile Tab Switcher */}
                        <div className="md:hidden flex border-b border-gray-200 bg-white shrink-0">
                            <button
                                onClick={() => setMobileView('list')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors ${mobileView === 'list'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500'
                                    }`}
                            >
                                节点列表 ({filteredProxies.length})
                            </button>
                            <button
                                onClick={() => setMobileView('detail')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors ${mobileView === 'detail'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500'
                                    }`}
                                disabled={!selectedProxy}
                            >
                                节点详情
                            </button>
                        </div>

                        {/* Main Content */}
                        <div className="flex flex-col md:flex-row flex-1 min-h-0">
                            {/* Left Sidebar: Proxy List */}
                            <div className={`w-full md:w-80 border-r border-gray-100 bg-gray-50 flex flex-col min-h-0 ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
                                <div className="px-3 py-3 border-b border-gray-200 bg-white shrink-0">
                                    <input
                                        type="text"
                                        placeholder="搜索节点..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setSelectedProxyIndex(0);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {filteredProxies.map((proxy, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleProxySelect(idx)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedProxy === proxy
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'hover:bg-gray-200 text-gray-700'
                                                }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${proxy.type === 'ss' ? 'bg-green-400' :
                                                proxy.type === 'vmess' ? 'bg-purple-400' :
                                                    proxy.type === 'trojan' ? 'bg-orange-400' :
                                                        proxy.type === 'vless' ? 'bg-pink-400' : 'bg-gray-400'
                                                }`} />
                                            <div className="truncate font-medium flex-1">{proxy.name}</div>
                                        </button>
                                    ))}
                                    {filteredProxies.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            无匹配节点
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Panel: Detail View */}
                            <div className={`flex-1 bg-white min-h-0 ${mobileView === 'detail' ? 'flex' : 'hidden md:flex'} flex-col`}>
                                {selectedProxy ? (
                                    <div className="h-full overflow-y-auto p-6">
                                        {/* Mobile Back Button */}
                                        <button
                                            onClick={() => setMobileView('list')}
                                            className="md:hidden flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            返回列表
                                        </button>

                                        {/* Header */}
                                        <div className="flex items-start justify-between border-b pb-4 mb-6">
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedProxy.name}</h3>
                                                <div className="flex gap-2 flex-wrap items-center">
                                                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                                        {selectedProxy.type.toUpperCase()}
                                                    </span>
                                                    {selectedProxy.udp && (
                                                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                                            UDP
                                                        </span>
                                                    )}
                                                    {selectedProxy.tls && (
                                                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                                                            TLS
                                                        </span>
                                                    )}
                                                    {selectedProxy.network && selectedProxy.network !== 'tcp' && (
                                                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                                                            {selectedProxy.network.toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Connection Info */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">基础连接</h4>
                                                <div className="space-y-3">
                                                    <div className="group">
                                                        <label className="text-xs text-gray-500 block mb-1">服务器地址</label>
                                                        <div className="flex items-center gap-2">
                                                            <code className="text-sm font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200 flex-1 break-all">{selectedProxy.server}</code>
                                                            <button onClick={() => copyToClipboard(selectedProxy.server || '', '服务器地址')} className="text-blue-600 hover:text-blue-700 text-xs px-2 py-1 hover:bg-blue-50 rounded transition-colors shrink-0">
                                                                复制
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-500 block mb-1">端口</label>
                                                        <code className="text-sm font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block">{selectedProxy.port}</code>
                                                    </div>
                                                    {selectedProxy.uuid && (
                                                        <div className="group">
                                                            <label className="text-xs text-gray-500 block mb-1">UUID</label>
                                                            <div className="flex items-center gap-2">
                                                                <code className="text-sm font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200 flex-1 break-all">{selectedProxy.uuid}</code>
                                                                <button onClick={() => copyToClipboard(selectedProxy.uuid || '', 'UUID')} className="text-blue-600 hover:text-blue-700 text-xs px-2 py-1 hover:bg-blue-50 rounded transition-colors shrink-0">
                                                                    复制
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {selectedProxy.password && (
                                                        <div className="group">
                                                            <label className="text-xs text-gray-500 block mb-1">密码</label>
                                                            <div className="flex items-center gap-2">
                                                                <code className="text-sm font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200 flex-1 break-all">{selectedProxy.password}</code>
                                                                <button onClick={() => copyToClipboard(selectedProxy.password || '', '密码')} className="text-blue-600 hover:text-blue-700 text-xs px-2 py-1 hover:bg-blue-50 rounded transition-colors shrink-0">
                                                                    复制
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {selectedProxy.cipher && (
                                                        <div>
                                                            <label className="text-xs text-gray-500 block mb-1">加密方式</label>
                                                            <span className="text-sm text-gray-800 font-medium">{selectedProxy.cipher}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Transport & Security */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">传输与安全</h4>
                                                <div className="space-y-3">
                                                    {selectedProxy.network && (
                                                        <div>
                                                            <label className="text-xs text-gray-500 block mb-1">传输协议</label>
                                                            <span className="text-sm font-medium text-gray-800">{selectedProxy.network}</span>
                                                        </div>
                                                    )}

                                                    {/* WS Settings */}
                                                    {selectedProxy['ws-opts'] && (
                                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                            <div className="font-semibold text-xs text-blue-700 mb-2">Websocket 配置</div>
                                                            <div className="space-y-2 text-sm">
                                                                {selectedProxy['ws-opts'].path && (
                                                                    <div>
                                                                        <span className="text-gray-600 text-xs block">Path</span>
                                                                        <code className="font-mono text-gray-900 break-all">{selectedProxy['ws-opts'].path}</code>
                                                                    </div>
                                                                )}
                                                                {selectedProxy['ws-opts'].headers?.Host && (
                                                                    <div>
                                                                        <span className="text-gray-600 text-xs block">Host</span>
                                                                        <code className="font-mono text-gray-900 break-all">{selectedProxy['ws-opts'].headers.Host}</code>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* gRPC Settings */}
                                                    {selectedProxy['grpc-opts'] && (
                                                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                                            <div className="font-semibold text-xs text-purple-700 mb-2">gRPC 配置</div>
                                                            <div className="space-y-2 text-sm">
                                                                {selectedProxy['grpc-opts']['grpc-service-name'] && (
                                                                    <div>
                                                                        <span className="text-gray-600 text-xs block">Service Name</span>
                                                                        <code className="font-mono text-gray-900 break-all">{selectedProxy['grpc-opts']['grpc-service-name']}</code>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TLS Settings */}
                                                    {(selectedProxy.tls || selectedProxy.servername || selectedProxy['skip-cert-verify'] !== undefined) && (
                                                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                                            <div className="font-semibold text-xs text-green-700 mb-2">TLS 安全</div>
                                                            <div className="space-y-2 text-sm">
                                                                {selectedProxy.servername && (
                                                                    <div>
                                                                        <span className="text-gray-600 text-xs block">SNI (Servername)</span>
                                                                        <code className="font-mono text-gray-900 break-all">{selectedProxy.servername}</code>
                                                                    </div>
                                                                )}
                                                                {selectedProxy['skip-cert-verify'] !== undefined && (
                                                                    <div>
                                                                        <span className="text-gray-600 text-xs block">跳过证书验证</span>
                                                                        <span className={`font-mono ${selectedProxy['skip-cert-verify'] ? 'text-red-600' : 'text-green-600'}`}>
                                                                            {selectedProxy['skip-cert-verify'] ? 'True' : 'False'}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {selectedProxy.alpn && (
                                                                    <div>
                                                                        <span className="text-gray-600 text-xs block">ALPN</span>
                                                                        <code className="font-mono text-gray-900">{selectedProxy.alpn.join(', ')}</code>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Raw JSON */}
                                        <div className="space-y-3 border-t pt-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">原始配置</h4>
                                                <button
                                                    onClick={() => copyToClipboard(JSON.stringify(selectedProxy, null, 2), 'JSON 配置')}
                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 hover:bg-blue-50 rounded transition-colors"
                                                >
                                                    复制 JSON
                                                </button>
                                            </div>
                                            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                                                <pre className="text-xs text-green-400 font-mono leading-relaxed">
                                                    {JSON.stringify(selectedProxy, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400">
                                        <div className="text-center">
                                            <div className="text-4xl mb-2">👈</div>
                                            <p>请在左侧选择一个节点查看详情</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {editingSource && (
                <StaticSourceEditor
                    sourceName={editingSource}
                    open={!!editingSource}
                    onClose={() => setEditingSource(null)}
                    onUpdate={() => {
                        // In a real app, we might need a way to refresh the parent data
                        // For now we just close or hope it revalidates soon.
                        // window.location.reload(); 
                    }}
                    defaultTab="nodes"
                />
            )}
        </div>
    );
}
