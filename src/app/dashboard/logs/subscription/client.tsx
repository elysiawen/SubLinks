'use client';

import type { APIAccessLog } from '@/lib/database/interface';
import Pagination from '@/components/Pagination';
import { useTranslations, useLocale } from 'next-intl';

interface SubscriptionLogsClientProps {
    logs: APIAccessLog[];
    total: number;
    currentPage: number;
    itemsPerPage: number;
}

export default function SubscriptionLogsClient({
    logs,
    total,
    currentPage,
    itemsPerPage
}: SubscriptionLogsClientProps) {
    const t = useTranslations('dashboard');
    const locale = useLocale();

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">{t('logs.subscription.heading')}</h1>
                    <p className="text-sm text-text-tertiary mt-1">{t('logs.subscription.description')}</p>
                </div>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                {/* Mobile View (Cards) */}
                <div className="md:hidden divide-y divide-border">
                    {logs.length === 0 ? (
                        <div className="p-6 text-center text-text-tertiary">{t('logs.subscription.empty')}</div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-text-tertiary font-mono">
                                        {formatDate(log.timestamp)}
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.status === 200
                                            ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                                            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                                        }`}>
                                        {log.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.apiType?.includes('订阅')
                                            ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                                            : 'bg-accent text-accent-foreground'
                                        }`}>
                                        {log.apiType || t('logs.subscription.unknown')}
                                    </span>
                                    <span className="text-sm font-mono text-text-secondary">{log.ip}</span>
                                </div>
                                <div className="text-xs text-text-tertiary truncate" title={log.ua}>
                                    {log.ua}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-surface text-text-tertiary font-medium border-b border-border">
                            <tr>
                                <th className="px-6 py-4">{t('logs.subscription.time')}</th>
                                <th className="px-6 py-4">{t('logs.subscription.type')}</th>
                                <th className="px-6 py-4">{t('logs.subscription.ip')}</th>
                                <th className="px-6 py-4">{t('logs.subscription.client')}</th>
                                <th className="px-6 py-4">{t('logs.subscription.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-text-tertiary">
                                        {t('logs.subscription.empty')}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted transition-colors">
                                        <td className="px-6 py-4 text-text-secondary whitespace-nowrap font-mono">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${log.apiType?.includes('订阅')
                                                    ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                                                    : 'bg-accent text-accent-foreground'
                                                }`}>
                                                {log.apiType || t('logs.subscription.unknown')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-text-secondary">
                                            {log.ip}
                                        </td>
                                        <td className="px-6 py-4 text-text-secondary max-w-xs truncate" title={log.ua}>
                                            {log.ua}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${log.status === 200
                                                    ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                                                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    total={total}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                />
            </div>
        </div>
    );
}
