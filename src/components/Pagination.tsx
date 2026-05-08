'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

interface PaginationProps {
    total: number;
    currentPage: number;
    itemsPerPage: number;
}

export default function Pagination({ total, currentPage, itemsPerPage }: PaginationProps) {
    const t = useTranslations('common.pagination');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const totalPages = Math.ceil(total / itemsPerPage);

    if (totalPages <= 1 && total === 0) return null;

    const createPageURL = (pageNumber: number | string) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', pageNumber.toString());
        return `${pathname}?${params.toString()}`;
    };

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        startTransition(() => {
            router.push(createPageURL(page));
        });
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        startTransition(() => {
            const params = new URLSearchParams(searchParams);
            params.set('limit', value);
            params.set('page', '1');
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    return (
        <div className="flex flex-col gap-4 mt-6 px-2">
            <div className="text-sm text-text-tertiary text-center sm:text-left">
                {t('showingRange', {
                    from: (currentPage - 1) * itemsPerPage + 1,
                    to: Math.min(currentPage * itemsPerPage, total),
                    total
                })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="w-full sm:w-auto">
                    <select
                        value={itemsPerPage}
                        onChange={handleLimitChange}
                        disabled={isPending}
                        className="w-full border border-border-input rounded-lg text-sm px-3 py-2 outline-none focus:border-accent-foreground disabled:opacity-50 disabled:bg-muted"
                    >
                        <option value="10">{t('perPage', { count: 10 })}</option>
                        <option value="30">{t('perPage', { count: 30 })}</option>
                        <option value="50">{t('perPage', { count: 50 })}</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || isPending}
                        className="px-3 sm:px-4 py-2 rounded-lg border border-border-input bg-card text-text-secondary text-sm font-medium hover:bg-muted hover:text-text-primary transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-card flex items-center gap-2 min-w-[70px] sm:min-w-[90px] justify-center"
                    >
                        {isPending ? (
                            <svg className="animate-spin h-4 w-4 text-text-tertiary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : t('prevPage')}
                    </button>

                    <div className="flex items-center gap-2 px-1 sm:px-2">
                        <span className="text-sm font-medium text-text-secondary whitespace-nowrap">
                            {t('pageInfo', { current: currentPage, total: Math.max(1, totalPages) })}
                        </span>
                        <div className="hidden sm:flex items-center gap-1">
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                className="w-12 px-1 py-1 text-center border border-border-input rounded-md text-sm outline-none focus:border-accent-foreground focus:ring-1 focus:ring-accent-foreground"
                                placeholder={t('pagePlaceholder')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = parseInt((e.target as HTMLInputElement).value);
                                        if (val >= 1 && val <= totalPages) {
                                            handlePageChange(val);
                                        }
                                        (e.target as HTMLInputElement).value = '';
                                    }
                                }}
                            />
                            <span className="text-xs text-text-quaternary">{t('go')}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || isPending}
                        className="px-3 sm:px-4 py-2 rounded-lg border border-border-input bg-card text-text-secondary text-sm font-medium hover:bg-muted hover:text-text-primary transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-card flex items-center gap-2 min-w-[70px] sm:min-w-[90px] justify-center"
                    >
                        {isPending ? (
                            <svg className="animate-spin h-4 w-4 text-text-tertiary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : t('nextPage')}
                    </button>
                </div>
            </div>
        </div>
    );
}
