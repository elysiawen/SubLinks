'use client';

import type { APIAccessLog } from '@/lib/database/interface';
import Pagination from '@/components/Pagination';

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
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
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
                    <h1 className="text-2xl font-bold text-gray-800">订阅日志</h1>
                    <p className="text-sm text-gray-500 mt-1">查看您的订阅链接访问记录</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Mobile View (Cards) */}
                <div className="md:hidden divide-y divide-gray-100">
                    {logs.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">暂无日志记录</div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-500 font-mono">
                                        {formatDate(log.timestamp)}
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.status === 200
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-red-50 text-red-700'
                                        }`}>
                                        {log.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.apiType?.includes('订阅')
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-blue-50 text-blue-700'
                                        }`}>
                                        {log.apiType || '未知'}
                                    </span>
                                    <span className="text-sm font-mono text-gray-600">{log.ip}</span>
                                </div>
                                <div className="text-xs text-gray-500 truncate" title={log.ua}>
                                    {log.ua}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">时间</th>
                                <th className="px-6 py-4">类型</th>
                                <th className="px-6 py-4">IP地址</th>
                                <th className="px-6 py-4">请求客户端</th>
                                <th className="px-6 py-4">状态码</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        暂无日志记录
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap font-mono">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${log.apiType?.includes('订阅')
                                                    ? 'bg-green-50 text-green-700'
                                                    : 'bg-blue-50 text-blue-700'
                                                }`}>
                                                {log.apiType || '未知'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-600">
                                            {log.ip}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={log.ua}>
                                            {log.ua}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${log.status === 200
                                                    ? 'bg-green-50 text-green-700'
                                                    : 'bg-red-50 text-red-700'
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
