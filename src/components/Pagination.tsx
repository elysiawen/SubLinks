'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

interface PaginationProps {
    total: number;
    currentPage: number;
    itemsPerPage: number;
}

export default function Pagination({ total, currentPage, itemsPerPage }: PaginationProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const totalPages = Math.ceil(total / itemsPerPage);

    // If no data or single page, don't show pagination if desired, 
    // but usually nice to show "Page 1 of 1" or similar.
    // Spec says "User/Sub management also add pagination", implying we want controls.

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
            params.set('page', '1'); // Reset to page 1
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    return (
        <div className="flex flex-col gap-4 mt-6 px-2">
            {/* 统计信息 - 移动端居中，桌面端左对齐 */}
            <div className="text-sm text-gray-500 text-center sm:text-left">
                显示 {(currentPage - 1) * itemsPerPage + 1} 到 {Math.min(currentPage * itemsPerPage, total)} 条，共 {total} 条
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* 每页条数选择器 */}
                <div className="w-full sm:w-auto">
                    <select
                        value={itemsPerPage}
                        onChange={handleLimitChange}
                        disabled={isPending}
                        className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
                    >
                        <option value="10">10 条/页</option>
                        <option value="30">30 条/页</option>
                        <option value="50">50 条/页</option>
                    </select>
                </div>

                {/* 分页控制 */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                    {/* 上一页按钮 */}
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || isPending}
                        className="px-3 sm:px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center gap-2 min-w-[70px] sm:min-w-[90px] justify-center"
                    >
                        {isPending ? (
                            <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : '上一页'}
                    </button>

                    {/* 页码信息和跳转 */}
                    <div className="flex items-center gap-2 px-1 sm:px-2">
                        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                            第 {currentPage} / {Math.max(1, totalPages)} 页
                        </span>
                        {/* 跳转功能 - 仅在桌面端显示 */}
                        <div className="hidden sm:flex items-center gap-1">
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                className="w-12 px-1 py-1 text-center border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="页码"
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
                            <span className="text-xs text-gray-400">跳转</span>
                        </div>
                    </div>

                    {/* 下一页按钮 */}
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || isPending}
                        className="px-3 sm:px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center gap-2 min-w-[70px] sm:min-w-[90px] justify-center"
                    >
                        {isPending ? (
                            <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : '下一页'}
                    </button>
                </div>
            </div>
        </div>
    );
}
