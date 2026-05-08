'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

interface DashboardStats {
    users: {
        total: number;
        active: number;
        inactive: number;
    };
    subscriptions: {
        total: number;
        active: number;
    };
    upstreamSources: {
        total: number;
        active: number;
        defaultSource: string | null;
    };
    recentAccess: {
        count24h: number;
    };
    latestLogs: {
        system: any[];
        access: any[];
    };
}

export default function DashboardClient({ stats }: { stats: DashboardStats }) {
    const router = useRouter();
    const t = useTranslations('admin.dashboard');
    const locale = useLocale();

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-text-primary">{t('systemOverview')}</h1>
                <p className="text-text-tertiary mt-1">{t('description')}</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/admin/users" className="block animate-slide-in-up">
                    <div className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">👥</span>
                            <span className="text-xs text-text-quaternary">{t('users')}</span>
                        </div>
                        <div className="text-3xl font-bold text-text-primary mb-1">{stats.users.total}</div>
                        <div className="flex gap-3 text-xs">
                            <span className="text-green-600">{t('active', { count: stats.users.active })}</span>
                            <span className="text-text-quaternary">{t('inactive', { count: stats.users.inactive })}</span>
                        </div>
                    </div>
                </Link>

                <Link href="/admin/subscriptions" className="block animate-slide-in-up delay-100">
                    <div className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">📝</span>
                            <span className="text-xs text-text-quaternary">{t('subscriptions')}</span>
                        </div>
                        <div className="text-3xl font-bold text-text-primary mb-1">{stats.subscriptions.total}</div>
                        <div className="text-xs text-green-600">{t('subActive', { count: stats.subscriptions.active })}</div>
                    </div>
                </Link>

                <Link href="/admin/sources" className="block animate-slide-in-up delay-200">
                    <div className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">📡</span>
                            <span className="text-xs text-text-quaternary">{t('upstreamSources')}</span>
                        </div>
                        <div className="text-3xl font-bold text-text-primary mb-1">{stats.upstreamSources.total}</div>
                        <div className="flex gap-3 text-xs">
                            <span className="text-green-600">{t('enabled', { count: stats.upstreamSources.active })}</span>
                            <span className="text-text-quaternary">{t('disabled', { count: stats.upstreamSources.total - stats.upstreamSources.active })}</span>
                        </div>
                        {stats.upstreamSources.defaultSource && (
                            <div className="text-xs text-yellow-600 mt-1">⭐ {stats.upstreamSources.defaultSource}</div>
                        )}
                    </div>
                </Link>

                <Link href="/admin/logs" className="block animate-slide-in-up delay-300">
                    <div className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">📈</span>
                            <span className="text-xs text-text-quaternary">{t('accessVolume')}</span>
                        </div>
                        <div className="text-3xl font-bold text-text-primary mb-1">{stats.recentAccess.count24h}</div>
                        <div className="text-xs text-text-tertiary">{t('recent24h')}</div>
                    </div>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    {t('quickActions')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => router.push('/admin/users')}
                        className="bg-accent text-accent-foreground px-4 py-3 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition-colors font-medium text-sm"
                    >
                        {t('addUser')}
                    </button>
                    <button
                        onClick={() => router.push('/admin/sources')}
                        className="bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/25 transition-colors font-medium text-sm"
                    >
                        {t('addSource')}
                    </button>
                    <button
                        onClick={() => router.push('/admin/logs')}
                        className="bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 px-4 py-3 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/25 transition-colors font-medium text-sm"
                    >
                        {t('viewLogs')}
                    </button>
                    <button
                        onClick={() => router.push('/admin/settings')}
                        className="bg-muted text-text-secondary px-4 py-3 rounded-lg hover:bg-muted transition-colors font-medium text-sm"
                    >
                        {t('systemSettings')}
                    </button>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* System Logs */}
                <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                            {t('latestSystemLogs')}
                        </h2>
                        <Link href="/admin/logs?tab=system" className="text-sm text-accent-foreground hover:underline">
                            {t('viewAll')}
                        </Link>
                    </div>
                    {stats.latestLogs.system.length === 0 ? (
                        <p className="text-text-quaternary text-sm text-center py-4">{t('noSystemLogs')}</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.latestLogs.system.map((log, idx) => (
                                <div key={idx} className="border-l-2 border-border-strong pl-3 py-1">
                                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                                        <span>{formatTimestamp(log.timestamp)}</span>
                                        <span className={`px-2 py-0.5 rounded ${log.status === 'success' ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' :
                                            log.status === 'failure' ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400' :
                                                'bg-muted text-text-secondary'
                                            }`}>
                                            {log.category}
                                        </span>
                                    </div>
                                    <p className="text-sm text-text-secondary mt-1">{log.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Access Logs */}
                <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                            {t('latestAccessLogs')}
                        </h2>
                        <Link href="/admin/logs?tab=access" className="text-sm text-accent-foreground hover:underline">
                            {t('viewAll')}
                        </Link>
                    </div>
                    {stats.latestLogs.access.length === 0 ? (
                        <p className="text-text-quaternary text-sm text-center py-4">{t('noAccessLogs')}</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.latestLogs.access.map((log: any, idx) => {
                                // Simple User-Agent parser
                                const ua = log.ua || log.userAgent || '';
                                let clientName = t('unknownClient');
                                if (ua.includes('Clash')) clientName = 'Clash';
                                else if (ua.includes('Shadowrocket')) clientName = 'Shadowrocket';
                                else if (ua.includes('Quantumult')) clientName = 'Quantumult';
                                else if (ua.includes('Surge')) clientName = 'Surge';
                                else if (ua.includes('Stash')) clientName = 'Stash';
                                else if (ua.includes('Mozilla') || ua.includes('Chrome') || ua.includes('Safari')) clientName = t('browser');
                                else if (ua.length > 0) clientName = ua.substring(0, 15) + '...';

                                // Construct path if missing (for API logs)
                                const displayPath = log.path || (log.token ? `/api/s/${log.token.substring(0, 8)}...` : t('apiRequest'));

                                return (
                                    <div key={idx} className="flex items-start justify-between border-b border-muted pb-2 last:border-0 last:pb-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-text-primary text-sm truncate">
                                                    {log.username || t('anonymousUser')}
                                                </span>
                                                <span className="text-xs text-text-quaternary">•</span>
                                                <span className="text-xs text-text-tertiary bg-muted px-1.5 py-0.5 rounded">
                                                    {clientName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-text-tertiary">
                                                <span className="truncate max-w-[150px]" title={log.token || log.path}>{displayPath}</span>
                                                {log.ip && (
                                                    <>
                                                        <span className="text-text-tertiary">|</span>
                                                        <span>{log.ip}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-text-quaternary whitespace-nowrap ml-2">
                                            {formatTimestamp(log.timestamp).split(' ')[1]}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
