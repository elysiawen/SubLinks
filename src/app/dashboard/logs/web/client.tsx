'use client';

import type { WebAccessLog } from '@/lib/database/interface';
import Pagination from '@/components/Pagination';

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
                    <h1 className="text-2xl font-bold text-gray-800">访问日志</h1>
                    <p className="text-sm text-gray-500 mt-1">查看您的网站访问历史记录</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Mobile View (Cards) */}
                <div className="md:hidden divide-y divide-gray-100">
                    {logs.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">暂无访问记录</div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="p-4 space-y-2">
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
                                <div className="text-sm font-medium text-gray-800 break-all font-mono">
                                    {log.path}
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span className="font-mono">{log.ip}</span>
                                    <span className="bg-gray-100 px-2 py-0.5 rounded truncate max-w-[120px]" title={log.ua}>
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
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">时间</th>
                                <th className="px-6 py-4">访问路径</th>
                                <th className="px-6 py-4">IP地址</th>
                                <th className="px-6 py-4">请求客户端</th>
                                <th className="px-6 py-4">状态码</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        暂无访问记录
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap font-mono">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-700">
                                            {log.path}
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
