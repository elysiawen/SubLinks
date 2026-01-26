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

    const [targetVisualLimit, setTargetVisualLimit] = useState(limit);
    const [totalLogs, setTotalLogs] = useState(0);
    const [isMergeMode, setIsMergeMode] = useState(true);

    // ... (existing state)

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

    const fetchLogs = async (
        pageNum: number,
        isRefresh = false,
        tab: 'api' | 'web' | 'system',
        pageSize: number,
        searchTerm: string,
        targetLimit: number
    ) => {
        setLoading(true);
        try {
            // Standard Pagination Mode (Non-Merge)
            if (!isMergeMode) {
                let currentRes;
                if (tab === 'api') {
                    currentRes = await getAPILogs(pageNum, pageSize, searchTerm);
                } else if (tab === 'web') {
                    currentRes = await getWebLogs(pageNum, pageSize, searchTerm);
                } else {
                    currentRes = await getSystemLogs(pageNum, pageSize, searchTerm);
                }

                if (activeTabRef.current !== tab) return;

                if (currentRes.error) {
                    console.error(currentRes.error);
                    return;
                }

                if (currentRes.logs) {
                    setLogs(currentRes.logs);
                    setTotalLogs(currentRes.total || 0);
                    // For standard pagination, hasMore is managed by page count
                }
                return;
            }

            let currentLogs: any[] = isRefresh ? [] : [...logs];
            // If we already have enough visual items (and not refreshing), we don't need to fetch
            if (!isRefresh) {
                const currentVisualCount = aggregateLogs(currentLogs, tab).length;
                if (currentVisualCount >= targetLimit) {
                    setLogs(currentLogs);
                    setLoading(false);
                    return;
                }
            }

            let apiPage = pageNum;
            let currentRes;
            let fetchedCount = 0;

            const maxFetches = 10; // Safety limit

            for (let i = 0; i < maxFetches; i++) {
                if (tab === 'api') {
                    currentRes = await getAPILogs(apiPage, pageSize, searchTerm);
                } else if (tab === 'web') {
                    currentRes = await getWebLogs(apiPage, pageSize, searchTerm);
                } else {
                    currentRes = await getSystemLogs(apiPage, pageSize, searchTerm);
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
                    setPage(apiPage); // Keep track of next page to fetch

                    // Check if we hit end of stream
                    if (currentRes.logs.length < pageSize) {
                        setHasMore(false);
                        break;
                    } else {
                        setHasMore(true);
                    }

                    // Check if we have enough visual items
                    const visualCount = aggregateLogs(currentLogs, tab).length;

                    // Specific fix: Ensure we have at least targetLimit visual items
                    if (visualCount >= targetLimit) break;

                    // Safety break if we fetched too many raw items
                    if (fetchedCount >= pageSize * 20) break;
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

    // Reset when tab, limit, search, or merge mode changes
    useEffect(() => {
        setPage(1);
        setLogs([]);
        setHasMore(true);
        setTargetVisualLimit(limit);
        fetchLogs(1, true, activeTab, limit, debouncedSearch, limit);
    }, [activeTab, limit, debouncedSearch, isMergeMode]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        fetchLogs(newPage, true, activeTab, limit, debouncedSearch, limit);
    };

    const loadMore = () => {
        const nextTarget = targetVisualLimit + limit;
        setTargetVisualLimit(nextTarget);
        // Use current 'page' which is already the next page index
        fetchLogs(page, false, activeTab, limit, debouncedSearch, nextTarget);
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

    const formatUserDisplay = (username?: string, nickname?: string) => {
        if (!username) return '-';
        if (nickname && nickname !== username) {
            return `${nickname} (${username})`;
        }
        return username;
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
        if (!isMergeMode) return logs;
        const aggregated = aggregateLogs(logs, activeTab);
        return aggregated.slice(0, targetVisualLimit);
    }, [logs, activeTab, targetVisualLimit, isMergeMode]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end border-b border-gray-200 pb-4 gap-4">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'api'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                    >
                        API访问
                    </button>
                    <button
                        onClick={() => setActiveTab('web')}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'web'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                    >
                        WEB访问
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'system'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                    >
                        系统
                    </button>
                </div>

                <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <div className="flex items-center space-x-3 select-none">
                        <button
                            onClick={() => setIsMergeMode(!isMergeMode)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${isMergeMode ? 'bg-blue-600' : 'bg-gray-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMergeMode ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                        <span className="text-sm text-gray-400 cursor-pointer" onClick={() => setIsMergeMode(!isMergeMode)}>合并显示</span>
                    </div>
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
                                                        {log.subRemark && (
                                                            <span className="text-gray-400 ml-1">（{log.subRemark}）</span>
                                                        )}
                                                    </div>
                                                    <div>{formatUserDisplay(log.username, log.nickname)}</div>
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
                                                    {formatUserDisplay(log.username, log.nickname)}
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
                                                        <span className="cursor-pointer hover:text-white transition-colors gap-2 inline-flex items-center break-all">
                                                            {log.message}
                                                            <span className="text-gray-500 text-xs select-none">{expandedLogs.has(log.id) ? '🔼' : '🔽'}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="break-all">{log.message}</span>
                                                    )}
                                                    {log.details && !log.isMerged && (
                                                        <pre className="mt-2 text-xs text-gray-400 bg-black/50 p-3 rounded border border-gray-800 overflow-x-auto break-all whitespace-pre-wrap max-w-lg scrollbar-thin scrollbar-thumb-gray-800">
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
                                                            {childLog.subRemark && (
                                                                <span className="text-gray-500 ml-1">（{childLog.subRemark}）</span>
                                                            )}
                                                        </div>
                                                        <div>{formatUserDisplay(childLog.username, childLog.nickname)}</div>
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
                                                        {formatUserDisplay(childLog.username, childLog.nickname)}
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
                                                <td className="px-6 py-3 text-sm text-gray-400 break-all">
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
                        <div key={log.id} className="p-4 hover:bg-white/[0.03] transition-colors max-w-full overflow-hidden">
                            <div className="space-y-3 max-w-full overflow-hidden">
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
                                                {log.subRemark && (
                                                    <span className="text-gray-400 ml-1">（{log.subRemark}）</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">用户:</span>
                                            <span className="text-sm text-gray-200">{formatUserDisplay(log.username, log.nickname)}</span>
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
                                            <span className="text-sm text-gray-200">{formatUserDisplay(log.username, log.nickname)}</span>
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
                                                className={`cursor-pointer hover:text-white transition-colors break-all ${expandedLogs.has(log.id) ? 'font-medium text-white' : ''}`}
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
                                                <div className="mt-2 pl-2 border-l-2 border-gray-700 space-y-2 w-full">
                                                    {log.mergedLogs.map((childLog: any) => (
                                                        <div key={childLog.id} className="text-xs bg-gray-900/50 p-1.5 rounded border border-gray-800 w-full min-w-0">
                                                            <div className="flex justify-between mb-1 gap-2 min-w-0">
                                                                <span className="text-gray-500 flex-shrink-0 text-[10px]">{new Date(childLog.timestamp).toLocaleTimeString()}</span>
                                                                <span className={`${getStatusColor(childLog.status)} flex-shrink-0 text-[10px]`}>{childLog.status}</span>
                                                            </div>
                                                            <div className="text-gray-300 break-all text-[11px] min-w-0">{childLog.message}</div>
                                                            {childLog.details && (
                                                                <div className="mt-1 text-gray-400 text-[10px] break-all min-w-0">
                                                                    {typeof childLog.details === 'string'
                                                                        ? childLog.details
                                                                        : JSON.stringify(childLog.details)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {log.details && !log.isMerged && (
                                                <pre className="text-xs text-gray-400 bg-black/50 p-3 rounded border border-gray-800 overflow-x-auto break-all whitespace-pre-wrap animate-in fade-in zoom-in-95 duration-200 mt-2">
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

                {isMergeMode ? (
                    (hasMore || processedLogs.length === targetVisualLimit) && (
                        <div className="p-4 text-center border-t border-gray-800 bg-black/20">
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium border border-gray-700 hover:border-gray-600"
                            >
                                {loading ? '加载中...' : '加载更多'}
                            </button>
                        </div>
                    )
                ) : (
                    <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-800 bg-black/20 text-sm">
                        <div className="text-gray-400 whitespace-nowrap">
                            共 {totalLogs} 条记录
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
                            <div className="flex items-center space-x-2 order-last sm:order-first sm:border-r sm:border-gray-700 sm:pr-4 sm:mr-2">
                                <span className="text-gray-300 whitespace-nowrap">跳转至</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={Math.ceil(totalLogs / limit) || undefined}
                                    defaultValue={page}
                                    key={page}
                                    className="w-12 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-center text-gray-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = parseInt(e.currentTarget.value);
                                            const max = Math.ceil(totalLogs / limit) || 999999;
                                            if (!isNaN(val) && val >= 1 && val <= max) {
                                                handlePageChange(val);
                                            }
                                        }
                                    }}
                                />
                                <span className="text-gray-300 whitespace-nowrap">页</span>
                            </div>

                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page <= 1 || loading}
                                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium border border-gray-700 hover:border-gray-600 whitespace-nowrap"
                            >
                                上一页
                            </button>
                            <span className="text-gray-300 whitespace-nowrap">
                                第 {page} / {Math.ceil(totalLogs / limit)} 页
                            </span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={!hasMore || loading}
                                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium border border-gray-700 hover:border-gray-600 whitespace-nowrap"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
