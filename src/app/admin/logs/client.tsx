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
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const next = new Set(expandedLogs);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpandedLogs(next);
    };

    const toggleToken = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const next = new Set(expandedTokens);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpandedTokens(next);
    };

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
            let currentLogs: any[] = isRefresh ? [] : [...logs];
            let apiPage = pageNum;
            let currentRes;

            let fetchedCount = 0;
            const isSystem = tab === 'system';
            const isWeb = tab === 'web';
            const isApi = tab === 'api';

            // Limit loop to avoid infinite requests. 
            // All aggregated logs allow more fetches.
            const maxFetches = (isSystem || isWeb || isApi) ? 10 : 1;

            for (let i = 0; i < maxFetches; i++) {
                if (tab === 'api') {
                    currentRes = await getAPILogs(apiPage, pageSize * 2, searchTerm);
                } else if (tab === 'web') {
                    // Fetch larger chunks for web logs too, as they might be heavily folded
                    currentRes = await getWebLogs(apiPage, pageSize * 2, searchTerm);
                } else {
                    // Fetch larger chunks for system logs to reduce round trips
                    currentRes = await getSystemLogs(apiPage, pageSize * 2, searchTerm);
                }

                // Check if tab changed while fetching
                if (activeTabRef.current !== tab) return;

                if (currentRes.error) {
                    console.error(currentRes.error);
                    return;
                }

                if (currentRes.logs && currentRes.logs.length > 0) {
                    currentLogs = [...currentLogs, ...currentRes.logs];
                    fetchedCount += currentRes.logs.length;

                    // Update state variables for next iteration
                    apiPage++;
                    setPage(apiPage); // Keep track of where we are in API pages

                    // Check if we hit end of stream
                    const fetchedSize = currentRes.logs.length;
                    // For aggregated logs (web, system, api), we request 2x logs
                    const isAggregated = tab === 'web' || tab === 'system' || tab === 'api';
                    const requestedSize = isAggregated ? pageSize * 2 : pageSize;

                    if (fetchedSize < requestedSize) {
                        setHasMore(false);
                        break;
                    } else {
                        setHasMore(true);
                    }

                    // Check if we have enough visual items
                    if (isAggregated) {
                        const visualCount = aggregateLogs(currentLogs, tab).length;

                        // Safety break if we fetched too many raw items (e.g. 10 pages worth)
                        if (fetchedCount >= pageSize * 10) break;

                        const baseCount = isRefresh ? 0 : aggregateLogs(logs, tab).length;
                        const addedVisualItems = visualCount - baseCount;

                        // If we have added at least pageSize visual items, we are good.
                        if (addedVisualItems >= pageSize) break;
                    } else {
                        break;
                    }
                } else {
                    setHasMore(false);
                    break;
                }
            }

            setLogs(currentLogs);

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

    // Log Aggregation Helper
    const aggregateLogs = (rawLogs: any[], tab: 'api' | 'web' | 'system') => {
        if (!rawLogs.length) return rawLogs;

        const result: any[] = [];
        let buffer: any[] = [];

        // System Log Aggregation (Time Window based)
        if (tab === 'system') {
            const flushBuffer = () => {
                if (buffer.length === 0) return;

                // Only merge if > 3 items
                if (buffer.length > 3) {
                    const head = buffer[0]; // Newest log

                    // Construct grouped details
                    // We now keep the full buffer for row rendering
                    const fullLogs = [...buffer];

                    // Calculate stats
                    const successCount = buffer.filter(l => {
                        const s = l.details?.httpStatus || l.status;
                        return (typeof s === 'number' && s >= 200 && s < 300) || s === 'success';
                    }).length;
                    const failCount = buffer.length - successCount;

                    result.push({
                        ...head,
                        message: `Subscription Precache (已合并 ${buffer.length} 条记录，成功 ${successCount} 个，失败 ${failCount} 个)`,
                        isMerged: true,
                        mergedLogs: fullLogs, // Store full logs
                    });
                } else {
                    result.push(...buffer);
                }
                buffer = [];
            };

            for (const log of rawLogs) {
                // Check if it's a System Precache log
                const isPrecache = log.category === 'system' &&
                    log.message &&
                    log.message.startsWith('Subscription Precache');

                if (isPrecache) {
                    if (buffer.length > 0) {
                        const head = buffer[0];
                        // Check time window (e.g., 20 seconds to capture a batch)
                        if (Math.abs(head.timestamp - log.timestamp) <= 20000) {
                            buffer.push(log);
                        } else {
                            flushBuffer();
                            buffer.push(log);
                        }
                    } else {
                        buffer.push(log);
                    }
                } else {
                    flushBuffer();
                    result.push(log);
                }
            }
            flushBuffer();
            return result;
        }

        // Web and API Log Aggregation (User/IP/Token Sequence based)
        if (tab === 'web' || tab === 'api') {
            const flushBuffer = () => {
                if (buffer.length === 0) return;

                // Merge if >= 3 items
                if (buffer.length >= 3) {
                    const head = buffer[0];
                    const fullLogs = [...buffer];

                    // Determine label
                    let label = `连续操作 (${buffer.length} 次)`;
                    if (tab === 'api') {
                        label = `连续请求 (${buffer.length} 次)`;
                    }

                    result.push({
                        ...head,
                        path: label, // Use 'path' field to store the summary label for simplicity in display logic key
                        // Or we can just detect isMerged
                        isMerged: true,
                        mergedLogs: fullLogs,
                        mergedCount: buffer.length
                    });
                } else {
                    result.push(...buffer);
                }
                buffer = [];
            };

            // Assuming logs are sorted by timestamp desc
            for (const log of rawLogs) {
                if (buffer.length > 0) {
                    const head = buffer[0];
                    let sameIdentity = false;

                    if (tab === 'web') {
                        sameIdentity = (head.username && head.username === log.username) ||
                            (!head.username && !log.username && head.ip === log.ip);
                    } else if (tab === 'api') {
                        // For API: Same Token OR Same Username OR Same IP (if no token/user)
                        if (head.token && log.token) {
                            sameIdentity = head.token === log.token;
                        } else if (head.username && log.username) {
                            sameIdentity = head.username === log.username;
                        } else {
                            sameIdentity = head.ip === log.ip;
                        }
                    }

                    // Fold by Day
                    const sameDay = new Date(head.timestamp).toDateString() === new Date(log.timestamp).toDateString();

                    if (sameIdentity && sameDay) {
                        buffer.push(log);
                    } else {
                        flushBuffer();
                        buffer.push(log);
                    }
                } else {
                    buffer.push(log);
                }
            }
            flushBuffer();
            return result;
        }

        return rawLogs;
    };

    // Log Aggregation Logic
    const processedLogs = React.useMemo(() => {
        return aggregateLogs(logs, activeTab);
    }, [logs, activeTab]);

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
                            {processedLogs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr className={`hover:bg-white/[0.03] transition-colors ${log.isMerged ? 'bg-gray-900/30 cursor-pointer' : ''}`} onClick={log.isMerged ? () => toggleExpand(log.id) : undefined}>
                                        <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString('zh-CN')}
                                            <div className="text-xs text-gray-500 mt-0.5">{formatTime(log.timestamp)}</div>
                                        </td>

                                        {activeTab === 'api' && (
                                            <>
                                                <td className="px-6 py-4 text-sm text-gray-200">
                                                    <div
                                                        className="font-mono text-xs text-blue-400 mb-0.5 cursor-pointer hover:text-blue-300 transition-colors"
                                                        title={log.token}
                                                        onClick={(e) => toggleToken(log.id, e)}
                                                    >
                                                        {expandedTokens.has(log.id) || (log.token || '').length <= 8
                                                            ? log.token
                                                            : `${(log.token || '').substring(0, 8)}...`}
                                                    </div>
                                                    <div>{log.username}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400">
                                                    <div className="text-gray-300">{log.ip}</div>
                                                    {!log.isMerged && (
                                                        <div className="text-xs text-gray-600 truncate max-w-[200px] mt-0.5" title={log.ua}>{log.ua}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400">
                                                    {log.isMerged ? (
                                                        <div className="flex items-center gap-2 text-blue-400 font-mono">
                                                            <span>{log.path}</span>{/* reusing path for label */}
                                                            <span className="text-gray-500 text-xs select-none">{expandedLogs.has(log.id) ? '🔼' : '🔽'}</span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="text-gray-300">{log.apiType || 'API请求'}</div>
                                                            {log.requestMethod && (
                                                                <div className="text-xs text-gray-600 mt-0.5">{log.requestMethod}</div>
                                                            )}
                                                        </div>
                                                    )}
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
                                                    {!log.isMerged && (
                                                        <div className="text-xs text-gray-600 truncate max-w-[200px] mt-0.5" title={log.ua}>{log.ua}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-emerald-400 font-mono">
                                                    {log.isMerged ? (
                                                        <div className="flex items-center gap-2">
                                                            <span>{log.path}</span>
                                                            <span className="text-gray-500 text-xs select-none">{expandedLogs.has(log.id) ? '🔼' : '🔽'}</span>
                                                        </div>
                                                    ) : (
                                                        log.path
                                                    )}
                                                </td>
                                            </>
                                        )}

                                        {activeTab === 'system' && (
                                            <>
                                                <td className="px-6 py-4 text-sm text-gray-300 col-span-2">
                                                    <span className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs mr-2 border border-gray-700">{log.category}</span>
                                                    {log.isMerged ? (
                                                        <span className="cursor-pointer hover:text-white transition-colors gap-2 inline-flex items-center">
                                                            {log.message}
                                                            <span className="text-gray-500 text-xs select-none">{expandedLogs.has(log.id) ? '🔼' : '🔽'}</span>
                                                        </span>
                                                    ) : (
                                                        log.message
                                                    )}
                                                    {log.details && !log.isMerged && (
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

                                    {/* Expanded Rows */}
                                    {log.isMerged && expandedLogs.has(log.id) && log.mergedLogs && log.mergedLogs.map((childLog: any) => (
                                        <tr key={childLog.id} className="bg-gray-800/20 hover:bg-gray-800/30 transition-colors animate-in fade-in slide-in-from-top-2 duration-200">
                                            <td className="px-6 py-3 text-sm text-gray-400 whitespace-nowrap pl-10 border-l-2 border-emerald-500/30">
                                                {new Date(childLog.timestamp).toLocaleTimeString('zh-CN')}
                                            </td>

                                            {activeTab === 'api' && (
                                                <>
                                                    <td className="px-6 py-3 text-sm text-gray-200">
                                                        <div
                                                            className="font-mono text-xs text-blue-400 mb-0.5 cursor-pointer hover:text-blue-300 transition-colors"
                                                            title={childLog.token}
                                                            onClick={(e) => toggleToken(childLog.id, e)}
                                                        >
                                                            {expandedTokens.has(childLog.id) || (childLog.token || '').length <= 8
                                                                ? childLog.token
                                                                : `${(childLog.token || '').substring(0, 8)}...`}
                                                        </div>
                                                        <div>{childLog.username}</div>
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-gray-400">
                                                        <div className="text-gray-300">{childLog.ip}</div>
                                                        <div className="text-xs text-gray-600 truncate max-w-[200px] mt-0.5" title={childLog.ua}>{childLog.ua}</div>
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-gray-400">
                                                        <div className="text-gray-300">{childLog.apiType || 'API请求'}</div>
                                                        {childLog.requestMethod && (
                                                            <div className="text-xs text-gray-600 mt-0.5">{childLog.requestMethod}</div>
                                                        )}
                                                    </td>
                                                </>
                                            )}

                                            {activeTab === 'web' && (
                                                <>
                                                    <td className="px-6 py-3 text-sm text-gray-400">
                                                        {childLog.username || '-'}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-gray-500">
                                                        <div className="text-gray-400">{childLog.ip}</div>
                                                        <div className="text-xs text-gray-600 truncate max-w-[200px] mt-0.5" title={childLog.ua}>{childLog.ua}</div>
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-gray-400 font-mono">
                                                        {childLog.path}
                                                    </td>
                                                </>
                                            )}

                                            {activeTab === 'system' && (
                                                <td className="px-6 py-3 text-sm text-gray-400">
                                                    {childLog.message}
                                                </td>
                                            )}

                                            <td className={`px-6 py-3 text-sm font-medium ${getStatusColor(childLog.status)}`}>
                                                {childLog.status}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-800/50">
                    {processedLogs.map((log) => (
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
                                            <span
                                                className="font-mono text-xs text-blue-400 break-all cursor-pointer"
                                                title={log.token}
                                                onClick={(e) => toggleToken(log.id, e)}
                                            >
                                                {expandedTokens.has(log.id) || (log.token || '').length <= 8
                                                    ? log.token
                                                    : `${(log.token || '').substring(0, 8)}...`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">用户:</span>
                                            <span className="text-sm text-gray-200">{log.username}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">IP:</span>
                                            <span className="text-sm text-gray-300">{log.ip}</span>
                                        </div>

                                        {/* API Log Details / Merged View */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">详情:</span>
                                            <div className="flex-1 text-sm text-gray-400">
                                                {log.isMerged ? (
                                                    <div className="flex items-center gap-2 text-blue-400 font-mono cursor-pointer" onClick={() => toggleExpand(log.id)}>
                                                        <span>{log.path}</span>
                                                        <span className="text-xs text-gray-500 select-none">{expandedLogs.has(log.id) ? '🔼' : '🔽'}</span>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="text-gray-300">{log.apiType || 'API请求'}</div>
                                                        {log.requestMethod && (
                                                            <div className="text-xs text-gray-600 mt-0.5">{log.requestMethod}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Child Logs for Mobile (API) */}
                                        {log.isMerged && expandedLogs.has(log.id) && log.mergedLogs && (
                                            <div className="mt-3 pl-3 border-l-2 border-blue-500/30 space-y-3">
                                                {log.mergedLogs.map((childLog: any) => (
                                                    <div key={childLog.id} className="text-xs bg-gray-900/50 p-2 rounded">
                                                        <div className="flex justify-between text-gray-500 mb-1">
                                                            <span>{new Date(childLog.timestamp).toLocaleTimeString('zh-CN')}</span>
                                                            <span className={getStatusColor(childLog.status)}>{childLog.status}</span>
                                                        </div>
                                                        <div className="text-gray-300">{childLog.apiType || 'API请求'}</div>
                                                        {childLog.requestMethod && (
                                                            <div className="text-xs text-gray-600 mt-0.5">{childLog.requestMethod}</div>
                                                        )}
                                                        <div className="mt-1 text-gray-600 break-words w-full" title={childLog.ua}>{childLog.ua}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {!log.isMerged && (
                                            <div className="text-xs text-gray-600 break-words w-full" title={log.ua}>
                                                {log.ua}
                                            </div>
                                        )}
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
                                            <div className="flex-1">
                                                {log.isMerged ? (
                                                    <div>
                                                        <div
                                                            className={`text-sm text-emerald-400 font-mono flex items-center gap-2 cursor-pointer ${expandedLogs.has(log.id) ? 'font-medium' : ''}`}
                                                            onClick={() => toggleExpand(log.id)}
                                                        >
                                                            <span>{log.path}</span>
                                                            <span className="text-xs text-gray-500 select-none">
                                                                {expandedLogs.has(log.id) ? '🔼' : '🔽'}
                                                            </span>
                                                        </div>
                                                        {expandedLogs.has(log.id) && log.details && (
                                                            <div className="mt-2 text-xs text-gray-400 bg-black/50 p-3 rounded border border-gray-800 animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="space-y-2">
                                                                    {log.details.map((d: any, idx: number) => (
                                                                        <div key={idx} className="flex justify-between items-center border-b border-gray-800/50 last:border-0 pb-1 last:pb-0">
                                                                            <span className="font-mono text-emerald-500/80">{d.path}</span>
                                                                            <span className="text-gray-600">{d.time}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-emerald-400 font-mono break-all">{log.path}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Child Logs for Mobile */}
                                        {log.isMerged && expandedLogs.has(log.id) && log.mergedLogs && (
                                            <div className="mt-3 pl-3 border-l-2 border-emerald-500/30 space-y-3">
                                                {log.mergedLogs.map((childLog: any) => (
                                                    <div key={childLog.id} className="text-xs bg-gray-900/50 p-2 rounded">
                                                        <div className="flex justify-between text-gray-500 mb-1">
                                                            <span>{new Date(childLog.timestamp).toLocaleTimeString('zh-CN')}</span>
                                                            <span className={getStatusColor(childLog.status)}>{childLog.status}</span>
                                                        </div>
                                                        <div className="font-mono text-gray-300 break-all">{childLog.path}</div>
                                                        <div className="mt-1 text-gray-600 break-words w-full" title={childLog.ua}>{childLog.ua}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {!log.isMerged && (
                                            <div className="text-xs text-gray-600 break-words w-full" title={log.ua}>
                                                {log.ua}
                                            </div>
                                        )}
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
                                            <div
                                                className={`cursor-pointer hover:text-white transition-colors ${expandedLogs.has(log.id) ? 'font-medium text-white' : ''}`}
                                                onClick={log.isMerged ? () => toggleExpand(log.id) : undefined}
                                            >
                                                {log.message}
                                                {log.isMerged && (
                                                    <span className="ml-2 text-xs text-gray-500">
                                                        {expandedLogs.has(log.id) ? '🔼' : '🔽'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Expanded System Logs Mobile */}
                                            {log.isMerged && expandedLogs.has(log.id) && log.mergedLogs && (
                                                <div className="mt-2 pl-3 border-l-2 border-gray-700 space-y-2">
                                                    {log.mergedLogs.map((childLog: any) => (
                                                        <div key={childLog.id} className="text-xs text-gray-400">
                                                            <div className="flex justify-between">
                                                                <span>{new Date(childLog.timestamp).toLocaleTimeString()}</span>
                                                                <span className={getStatusColor(childLog.status)}>{childLog.status}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {log.details && !log.isMerged && (
                                                <pre className="text-xs text-gray-400 bg-black/50 p-3 rounded border border-gray-800 overflow-x-auto animate-in fade-in zoom-in-95 duration-200 mt-2">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {
                    logs.length === 0 && !loading && (
                        <div className="text-center py-16">
                            <div className="text-gray-600 mb-2 text-4xl">📭</div>
                            <div className="text-gray-500">
                                {debouncedSearch ? '没有找到匹配的日志' : '暂无日志记录'}
                            </div>
                        </div>
                    )
                }

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
