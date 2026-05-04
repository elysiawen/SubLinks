'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ServerStatus {
    environment: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    hostname: string;
    database: string;
    dbLatency: number | null;
    uptime: number;
    systemUptime: number;
    memory: {
        process: {
            used: number;
            total: number;
            percentage: number;
            rss: number;
            external: number;
        };
        system: {
            used: number;
            total: number;
            free: number;
            percentage: number;
        };
    };
    cpu: {
        model: string;
        cores: number;
        speed: number;
        usage: number;
        loadAverage: {
            '1min': number;
            '5min': number;
            '15min': number;
        };
    };
    network: Array<{
        name: string;
        addresses: Array<{
            address: string;
            family: string;
            mac: string;
        }>;
    }>;
    timestamp: number;
}

export default function ServerStatusClient() {
    const t = useTranslations('admin.status');
    const [status, setStatus] = useState<ServerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/admin/status');
            if (!res.ok) throw new Error('Failed to fetch status');
            const data = await res.json();
            setStatus(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}${t('days')}`);
        if (hours > 0) parts.push(`${hours}${t('hours')}`);
        if (minutes > 0) parts.push(`${minutes}${t('minutes')}`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}${t('seconds')}`);

        return parts.join(' ');
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-48 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    ❌ {t('loadFailed')}: {error}
                </div>
            </div>
        );
    }

    if (!status) return null;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                    <p className="text-sm text-gray-500 mt-1">{t('hostname', { hostname: status.hostname })}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>{t('realtimeMonitor')}</span>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Environment */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">🌐</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{t('environment')}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('envLabel')}</span>
                            <span className="font-medium text-gray-900">{status.environment}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Node.js</span>
                            <span className="font-medium text-gray-900">{status.nodeVersion}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('platform')}</span>
                            <span className="font-medium text-gray-900">{status.platform}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('architecture')}</span>
                            <span className="font-medium text-gray-900">{status.arch}</span>
                        </div>
                    </div>
                </div>

                {/* Database */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">💾</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{t('database')}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('dbType')}</span>
                            <span className="font-medium text-gray-900">{status.database}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('dbLatency')}</span>
                            <span className={`font-medium ${status.dbLatency === null ? 'text-red-600' :
                                status.dbLatency < 50 ? 'text-green-600' :
                                    status.dbLatency < 100 ? 'text-yellow-600' :
                                        'text-red-600'
                                }`}>
                                {status.dbLatency === null ? t('dbConnectFailed') : `${status.dbLatency}ms`}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('dbStatus')}</span>
                            <span className={`font-medium ${status.dbLatency !== null ? 'text-green-600' : 'text-red-600'}`}>
                                {status.dbLatency !== null ? `✓ ${t('dbConnected')}` : `✗ ${t('dbDisconnected')}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* CPU Info */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">⚡</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{t('cpuInfo')}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('cpuCores')}</span>
                            <span className="font-medium text-gray-900">{status.cpu.cores}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('cpuFrequency')}</span>
                            <span className="font-medium text-gray-900">{status.cpu.speed} MHz</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t('cpuLoad')}</span>
                            <span className="font-medium text-gray-900">{status.cpu.loadAverage['1min'].toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={status.cpu.model}>
                            {status.cpu.model}
                        </div>
                    </div>
                </div>

                {/* Process Uptime */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">⏱️</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{t('processUptime')}</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="text-xl font-bold text-gray-900">
                            {formatUptime(status.uptime)}
                        </div>
                        <div className="text-gray-600 text-xs">
                            {t('processUptimeDesc')}
                        </div>
                    </div>
                </div>

                {/* System Uptime */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">🖥️</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{t('systemUptime')}</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="text-xl font-bold text-gray-900">
                            {formatUptime(status.systemUptime)}
                        </div>
                        <div className="text-gray-600 text-xs">
                            {t('systemUptimeDesc')}
                        </div>
                    </div>
                </div>

                {/* Process Memory */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">🔲</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{t('processMemory')}</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{t('memoryUsed')}</span>
                            <span className="font-medium text-gray-900">{formatBytes(status.memory.process.used)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${status.memory.process.percentage < 70 ? 'bg-green-500' :
                                    status.memory.process.percentage < 85 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                    }`}
                                style={{ width: `${Math.min(status.memory.process.percentage, 100)}%` }}
                            ></div>
                        </div>
                        <div className="text-right text-sm font-medium text-gray-700">
                            {status.memory.process.percentage.toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* System Resources - CPU & Memory */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-3">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">📊</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{t('systemResources')}</h3>
                    </div>
                    <div className="space-y-6">
                        {/* CPU Usage */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600">{t('cpuUsage')}</span>
                                <span className="text-sm font-medium text-gray-900">{status.cpu.usage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className={`h-3 rounded-full transition-all duration-300 ${status.cpu.usage > 80 ? 'bg-red-500' :
                                        status.cpu.usage > 60 ? 'bg-yellow-500' :
                                            'bg-green-500'
                                        }`}
                                    style={{ width: `${Math.min(status.cpu.usage, 100)}%` }}
                                />
                            </div>
                        </div>
                        {/* Memory Usage */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600">{t('memoryUsage')}</span>
                                <span className="text-sm font-medium text-gray-900">{status.memory.system.percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className={`h-3 rounded-full transition-all duration-300 ${status.memory.system.percentage < 70 ? 'bg-purple-500' :
                                        status.memory.system.percentage < 85 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                        }`}
                                    style={{ width: `${Math.min(status.memory.system.percentage, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                            <div className="text-xs text-gray-600">{t('memoryUsedLabel')}</div>
                            <div className="text-sm font-medium text-gray-900">{formatBytes(status.memory.system.used)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">{t('memoryFree')}</div>
                            <div className="text-sm font-medium text-gray-900">{formatBytes(status.memory.system.free)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">{t('memoryTotal')}</div>
                            <div className="text-sm font-medium text-gray-900">{formatBytes(status.memory.system.total)}</div>
                        </div>
                    </div>
                </div>

                {/* Network */}
                {status.network.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:col-span-2 lg:col-span-3">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">🌐</span>
                            </div>
                            <h3 className="font-semibold text-gray-800">{t('networkInterfaces')}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {status.network.map((iface, idx) => (
                                <div key={idx} className="bg-gray-50 rounded-lg p-4">
                                    <div className="font-medium text-gray-900 mb-2">{iface.name}</div>
                                    {iface.addresses.map((addr, addrIdx) => (
                                        <div key={addrIdx} className="text-xs text-gray-600 space-y-1 mb-2">
                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                <span className="text-gray-500">{addr.family}:</span>
                                                <span className="font-mono break-all text-gray-900">{addr.address}</span>
                                            </div>
                                            {addr.mac && (
                                                <div className="text-gray-500 break-all">MAC: {addr.mac}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p>💡 <strong>{t('footerTip', { time: new Date(status.timestamp).toLocaleTimeString('zh-CN') })}</strong></p>
            </div>
        </div>
    );
}
