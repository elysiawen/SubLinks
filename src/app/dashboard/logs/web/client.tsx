'use client';

import type { WebAccessLog } from '@/lib/database/interface';
import Pagination from '@/components/Pagination';
import { useTranslations, useLocale } from 'next-intl';

interface WebLogsClientProps {
    logs: WebAccessLog[];
    total: number;
    currentPage: number;
    itemsPerPage: number;
}

export default function WebLogsClient({
    logs,
    total,
    currentPage,
    itemsPerPage
}: WebLogsClientProps) {
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
                    <h1 className="text-2xl font-bold text-text-primary">{t('logs.web.heading')}</h1>
                    <p className="text-sm text-text-tertiary mt-1">{t('logs.web.description')}</p>
                </div>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                {/* Mobile View (Cards) */}
                <div className="md:hidden divide-y divide-border">
                    {logs.length === 0 ? (
                        <div className="p-6 text-center text-text-tertiary">{t('logs.web.empty')}</div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="p-4 space-y-2">
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
                                <div className="text-sm font-medium text-text-primary break-all font-mono">
                                    {log.path}
                                </div>
                                <div className="flex items-center justify-between text-xs text-text-tertiary">
                                    <span className="font-mono">{log.ip}</span>
                                    <span className="bg-muted px-2 py-0.5 rounded truncate max-w-[120px]" title={log.ua}>
                                        {log.ua}
                                    </span>
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
                                <th className="px-6 py-4">{t('logs.web.time')}</th>
                                <th className="px-6 py-4">{t('logs.web.path')}</th>
                                <th className="px-6 py-4">{t('logs.web.ip')}</th>
                                <th className="px-6 py-4">{t('logs.web.client')}</th>
                                <th className="px-6 py-4">{t('logs.web.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-text-tertiary">
                                        {t('logs.web.empty')}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted transition-colors">
                                        <td className="px-6 py-4 text-text-secondary whitespace-nowrap font-mono">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-text-secondary">
                                            {log.path}
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
