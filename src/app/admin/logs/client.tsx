'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAPILogs, getWebLogs, getSystemLogs } from './actions';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Search } from 'lucide-react';

interface LogBase {
    id: string;
    timestamp: number;
    status: number | string;
}

export default function LogsClient() {
    const [activeTab, setActiveTab] = useState<'api' | 'web' | 'system'>('api');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Track active tab to prevent race conditions
    const activeTabRef = useRef(activeTab);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

    // Anti-shake search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchLogs = async (pageNum: number, isRefresh = false, tab: 'api' | 'web' | 'system', pageSize: number, searchTerm: string) => {
        setLoading(true);
        try {
            let res;
            if (tab === 'api') {
                res = await getAPILogs(pageNum, pageSize, searchTerm);
            } else if (tab === 'web') {
                res = await getWebLogs(pageNum, pageSize, searchTerm);
            } else {
                res = await getSystemLogs(pageNum, pageSize, searchTerm);
            }

            // Check if tab changed while fetching
            if (activeTabRef.current !== tab) return;

            if (res.error) {
                console.error(res.error);
                return;
            }

            if (res.logs) {
                if (isRefresh) {
                    setLogs(res.logs);
                } else {
                    setLogs(prev => [...prev, ...res.logs]);
                }
                setHasMore(res.logs.length === pageSize);
            }
        } finally {
            if (activeTabRef.current === tab) {
                setLoading(false);
            }
        }
    };

    // Reset when tab, limit, or search changes
    useEffect(() => {
        setPage(1);
        setLogs([]);
        setHasMore(true);
        fetchLogs(1, true, activeTab, limit, debouncedSearch);
    }, [activeTab, limit, debouncedSearch]);

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchLogs(nextPage, false, activeTab, limit, debouncedSearch);
    };

    const formatTime = (ts: number) => {
        try {
            return formatDistanceToNow(ts, { addSuffix: true, locale: zhCN });
        } catch (e) {
            return '未知时间';
        }
    };

    const getStatusColor = (status: number | string) => {
        if (typeof status === 'number') {
            if (status >= 200 && status < 300) return 'text-green-400';
            if (status >= 400 && status < 500) return 'text-yellow-400';
            return 'text-red-400';
        }
        return status === 'success' ? 'text-green-400' : 'text-red-400';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-end border-b border-gray-200 pb-4 gap-4">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'api'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                    >
                        API访问日志
                    </button>
                    <button
                        onClick={() => setActiveTab('web')}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'web'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                    >
                        网站访问日志
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'system'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                    >
                        系统日志
                    </button>
                </div>

                <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="搜索日志..."
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-gray-500 focus:border-gray-500 block w-full pl-10 p-2 shadow-sm"
                        />
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-600 whitespace-nowrap">
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-gray-500 focus:border-gray-500 block p-2 shadow-sm"
                        >
                            <option value={10}>10条/页</option>
                            <option value={20}>20条/页</option>
                            <option value={50}>50条/页</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 shadow-xl overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 border-b border-gray-800 text-gray-400 text-sm">
                                <th className="px-6 py-4 font-medium tracking-wide">时间</th>
                                {activeTab !== 'system' && <th className="px-6 py-4 font-medium tracking-wide">用户/Token</th>}
                                {activeTab !== 'system' && <th className="px-6 py-4 font-medium tracking-wide">IP / 来源</th>}
                                <th className="px-6 py-4 font-medium tracking-wide">详情</th>
                                <th className="px-6 py-4 font-medium tracking-wide">状态</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                                        <div className="text-xs text-gray-500 mt-0.5">{formatTime(log.timestamp)}</div>
                                    </td>

                                    {activeTab === 'api' && (
                                        <>
                                            <td className="px-6 py-4 text-sm text-gray-200">
                                                <div className="font-mono text-xs text-blue-400 mb-0.5">{(log.token || '').substring(0, 8)}...</div>
                                                <div>{log.username}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-400">
                                                <div className="text-gray-300">{log.ip}</div>
                                                <div className="text-xs text-gray-600 truncate max-w-[200px] mt-0.5" title={log.ua}>{log.ua}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-400">
                                                API请求
                                            </td>
                                        </>
                                    )}

                                    {activeTab === 'web' && (
                                        <>
                                            <td className="px-6 py-4 text-sm text-gray-200">
                                                {log.username || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-400">
                                                <div className="text-gray-300">{log.ip}</div>
                                                <div className="text-xs text-gray-600 truncate max-w-[200px] mt-0.5" title={log.ua}>{log.ua}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-emerald-400 font-mono">
                                                {log.path}
                                            </td>
                                        </>
                                    )}

                                    {activeTab === 'system' && (
                                        <>
                                            <td className="px-6 py-4 text-sm text-gray-300 col-span-2">
                                                <span className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs mr-2 border border-gray-700">{log.category}</span>
                                                {log.message}
                                                {log.details && (
                                                    <pre className="mt-2 text-xs text-gray-400 bg-black/50 p-3 rounded border border-gray-800 overflow-x-auto max-w-lg scrollbar-thin scrollbar-thumb-gray-800">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                )}
                                            </td>
                                        </>
                                    )}

                                    <td className={`px-6 py-4 text-sm font-medium ${getStatusColor(log.status)}`}>
                                        {log.status}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-800/50">
                    {logs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-white/[0.03] transition-colors">
                            <div className="space-y-3">
                                {/* Time and Status */}
                                <div className="flex items-start justify-between">
                                    <div className="text-xs text-gray-400">
                                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                                        <div className="text-gray-500 mt-0.5">{formatTime(log.timestamp)}</div>
                                    </div>
                                    <span className={`text-xs font-medium ${getStatusColor(log.status)}`}>
                                        {log.status}
                                    </span>
                                </div>

                                {/* API Logs */}
                                {activeTab === 'api' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Token:</span>
                                            <span className="font-mono text-xs text-blue-400">{(log.token || '').substring(0, 8)}...</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">用户:</span>
                                            <span className="text-sm text-gray-200">{log.username}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">IP:</span>
                                            <span className="text-sm text-gray-300">{log.ip}</span>
                                        </div>
                                        <div className="text-xs text-gray-600 break-all" title={log.ua}>
                                            {log.ua}
                                        </div>
                                    </div>
                                )}

                                {/* Web Logs */}
                                {activeTab === 'web' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">用户:</span>
                                            <span className="text-sm text-gray-200">{log.username || '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">IP:</span>
                                            <span className="text-sm text-gray-300">{log.ip}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">路径:</span>
                                            <span className="text-sm text-emerald-400 font-mono break-all">{log.path}</span>
                                        </div>
                                        <div className="text-xs text-gray-600 break-all" title={log.ua}>
                                            {log.ua}
                                        </div>
                                    </div>
                                )}

                                {/* System Logs */}
                                {activeTab === 'system' && (
                                    <div className="space-y-2">
                                        <div>
                                            <span className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs border border-gray-700">
                                                {log.category}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-300">
                                            {log.message}
                                        </div>
                                        {log.details && (
                                            <pre className="text-xs text-gray-400 bg-black/50 p-3 rounded border border-gray-800 overflow-x-auto">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {logs.length === 0 && !loading && (
                    <div className="text-center py-16">
                        <div className="text-gray-600 mb-2 text-4xl">📭</div>
                        <div className="text-gray-500">
                            {debouncedSearch ? '没有找到匹配的日志' : '暂无日志记录'}
                        </div>
                    </div>
                )}

                {hasMore && (
                    <div className="p-4 text-center border-t border-gray-800 bg-black/20">
                        <button
                            onClick={loadMore}
                            disabled={loading}
                            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium border border-gray-700 hover:border-gray-600"
                        >
                            {loading ? '加载中...' : '加载更多'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
