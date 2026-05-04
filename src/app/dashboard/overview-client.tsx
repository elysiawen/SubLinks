'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import { useTranslations } from 'next-intl';
import AnnouncementBanner from '@/components/AnnouncementBanner';


interface APIAccessLog {
    id: string;
    token: string;
    username: string;
    ip: string;
    ua: string;
    status: number;
    timestamp: number;
    apiType?: string;
    requestMethod?: string;
}

interface UpstreamSource {
    name: string;
    url?: string;
    enabled?: boolean;
    lastUpdated?: number;
    status?: 'pending' | 'success' | 'failure';
    traffic?: {
        upload: number;
        download: number;
        total: number;
        expire: number;
    };
}

interface OverviewClientProps {
    totalSubs: number;
    enabledSubs: number;
    accessLogs: APIAccessLog[];
    upstreamSources: UpstreamSource[];
    apiCount24h: number;
    userCreatedAt: number;
    customBackgroundUrl?: string;
    baseUrl: string;
    username: string;
    nickname?: string;
    announcement?: string;
}

export default function OverviewClient({ totalSubs, enabledSubs, accessLogs, upstreamSources, apiCount24h, userCreatedAt, customBackgroundUrl, baseUrl, username, nickname, announcement }: OverviewClientProps) {
    const { success, error } = useToast();
    const t = useTranslations('dashboard.overview');

    const [hitokoto, setHitokoto] = useState(t('hitokotoLoading'));

    // Fetch Hitokoto
    useEffect(() => {
        fetch('https://v1.hitokoto.cn/')
            .then(response => response.json())
            .then(data => {
                if (data.hitokoto) {
                    setHitokoto(data.hitokoto);
                }
            })
            .catch(() => {
                // Keep default text on error
            });
    }, []);



    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Welcome Header */}
                <div
                    className={`relative rounded-2xl p-8 text-white shadow-lg overflow-hidden ${announcement ? 'lg:col-span-2' : 'lg:col-span-3'}`}
                    style={customBackgroundUrl ? {
                        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${customBackgroundUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    } : {}}
                >
                    {!customBackgroundUrl && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                    )}
                    <div className="relative z-10 flex flex-col justify-center h-full">
                        <h1 className="text-3xl font-bold mb-2">{t('welcome', { name: nickname || username })}</h1>
                        <p className="text-blue-100">{hitokoto}</p>
                    </div>
                </div>

                {/* Announcement Banner - Right Side */}
                {announcement && <AnnouncementBanner content={announcement} className="lg:col-span-1 h-full" />}
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Combined Subscription Stats */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-medium text-blue-900">{t('subscriptionStats')}</h3>
                        <span className="text-2xl">📋</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-4xl font-bold text-blue-900">{totalSubs}</p>
                            <p className="text-xs text-blue-700 mt-1">{t('totalSubs')}</p>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-blue-700">{t('enabled')}</span>
                                <span className="text-lg font-bold text-green-600">{enabledSubs}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-blue-700">{t('disabled')}</span>
                                <span className="text-lg font-bold text-gray-500">{totalSubs - enabledSubs}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Registration Time */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-medium text-purple-900">{t('registrationTime')}</h3>
                        <span className="text-2xl">📅</span>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-purple-900">{formatDate(userCreatedAt)}</p>
                        <div className="mt-3 pt-3 border-t border-purple-200">
                            <p className="text-xs text-purple-700">
                                {t('daysUsed', { days: Math.floor((Date.now() - userCreatedAt) / (1000 * 60 * 60 * 24)) })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 24h API Count */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-medium text-green-900">{t('requests24h')}</h3>
                        <span className="text-2xl">📊</span>
                    </div>
                    <div>
                        <p className="text-4xl font-bold text-green-900">{apiCount24h}</p>
                        <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs text-green-700">{t('apiAccessCount')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upstream Sources */}
            {upstreamSources.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('upstreamInfo')}</h2>
                    <div className="space-y-4">
                        {upstreamSources.map((source) => {
                            const formatBytes = (bytes: number) => {
                                if (bytes === 0) return '0 B';
                                const k = 1024;
                                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                                const i = Math.floor(Math.log(bytes) / Math.log(k));
                                return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
                            };

                            const formatSourceDate = (timestamp?: number) => {
                                if (!timestamp) return t('notUpdated');
                                const date = new Date(timestamp);
                                return date.toLocaleString('zh-CN', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            };

                            const getStatusColor = (source: UpstreamSource) => {
                                if (source.enabled === false) return 'bg-gray-100 text-gray-500 border-gray-200';

                                switch (source.status) {
                                    case 'success': return 'bg-green-100 text-green-700 border-green-200';
                                    case 'failure': return 'bg-red-100 text-red-700 border-red-200';
                                    case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
                                    default: return 'bg-gray-100 text-gray-700 border-gray-200';
                                }
                            };

                            const getStatusText = (source: UpstreamSource) => {
                                if (source.enabled === false) return t('statusDisabled');

                                switch (source.status) {
                                    case 'success': return t('statusNormal');
                                    case 'failure': return t('statusFailed');
                                    case 'pending': return t('statusUpdating');
                                    default: return t('statusUnknown');
                                }
                            };

                            return (
                                <div key={source.name} className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-semibold text-gray-800">{source.name}</h3>
                                        <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(source)}`}>
                                            {getStatusText(source)}
                                        </span>
                                    </div>

                                    {source.traffic ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">{t('usedTraffic')}</span>
                                                <span className="font-medium text-gray-800">
                                                    {formatBytes(source.traffic.upload + source.traffic.download)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">{t('totalTraffic')}</span>
                                                <span className="font-medium text-gray-800">
                                                    {formatBytes(source.traffic.total)}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                                <div
                                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                                    style={{
                                                        width: `${Math.min(100, ((source.traffic.upload + source.traffic.download) / source.traffic.total) * 100)}%`
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>{t('usageRate', { rate: Math.round(((source.traffic.upload + source.traffic.download) / source.traffic.total) * 100) })}</span>
                                                {source.traffic.expire > 0 && (
                                                    <span>{t('expire', { date: new Date(source.traffic.expire * 1000).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) })}</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">{t('noTrafficInfo')}</p>
                                    )}

                                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                                        {t('lastUpdated', { time: formatSourceDate(source.lastUpdated) })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Access Logs */}
            {accessLogs.length > 0 && (
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base md:text-lg font-semibold text-gray-800">{t('accessLogs')}</h2>
                        <span className="text-xs md:text-sm text-gray-500">{t('recentCount', { count: accessLogs.length })}</span>
                    </div>
                    <div className="space-y-2 md:space-y-3">
                        {accessLogs.map((log) => {
                            const formatLogDate = (timestamp: number) => {
                                const date = new Date(timestamp);
                                return date.toLocaleString('zh-CN', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            };

                            const getStatusColor = (status: number) => {
                                if (status >= 200 && status < 300) return 'text-green-600';
                                if (status >= 400) return 'text-red-600';
                                return 'text-gray-600';
                            };

                            return (
                                <div key={log.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-800 text-xs md:text-sm truncate">
                                                {log.apiType || t('subscriptionRequest')}
                                            </span>
                                            <span className={`text-xs font-mono ${getStatusColor(log.status)}`}>
                                                {log.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="font-mono">{log.ip}</span>
                                            <span className="hidden md:inline">•</span>
                                            <span className="hidden md:inline truncate">{log.ua.substring(0, 40)}...</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between md:flex-col md:items-end md:text-right md:ml-4 flex-shrink-0">
                                        <p className="text-xs text-gray-500">{formatLogDate(log.timestamp)}</p>
                                        {log.requestMethod && (
                                            <p className="text-xs text-gray-400">{log.requestMethod}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Password Change Modal */}

        </div>
    );
}
