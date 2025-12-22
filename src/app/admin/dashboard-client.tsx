'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
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
                <h1 className="text-3xl font-bold text-gray-800">📊 系统概览</h1>
                <p className="text-gray-500 mt-1">管理后台数据统计与快捷操作</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Users Card */}
                <Link href="/admin/users" className="block">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">👥</span>
                            <span className="text-xs text-gray-400">用户</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-800 mb-1">{stats.users.total}</div>
                        <div className="flex gap-3 text-xs">
                            <span className="text-green-600">✓ {stats.users.active} 活跃</span>
                            <span className="text-gray-400">✗ {stats.users.inactive} 停用</span>
                        </div>
                    </div>
                </Link>

                {/* Subscriptions Card */}
                <Link href="/admin/subscriptions" className="block">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">📝</span>
                            <span className="text-xs text-gray-400">订阅</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-800 mb-1">{stats.subscriptions.total}</div>
                        <div className="text-xs text-green-600">✓ {stats.subscriptions.active} 活跃</div>
                    </div>
                </Link>

                {/* Upstream Sources Card */}
                <Link href="/admin/sources" className="block">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">📡</span>
                            <span className="text-xs text-gray-400">上游源</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-800 mb-1">{stats.upstreamSources.total}</div>
                        {stats.upstreamSources.defaultSource && (
                            <div className="text-xs text-yellow-600">⭐ {stats.upstreamSources.defaultSource}</div>
                        )}
                    </div>
                </Link>

                {/* Recent Access Card */}
                <Link href="/admin/logs" className="block">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">📈</span>
                            <span className="text-xs text-gray-400">访问量</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-800 mb-1">{stats.recentAccess.count24h}</div>
                        <div className="text-xs text-gray-500">最近 24 小时</div>
                    </div>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    ⚡ 快捷操作
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => router.push('/admin/users')}
                        className="bg-blue-50 text-blue-600 px-4 py-3 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                    >
                        👤 添加用户
                    </button>
                    <button
                        onClick={() => router.push('/admin/sources')}
                        className="bg-green-50 text-green-600 px-4 py-3 rounded-lg hover:bg-green-100 transition-colors font-medium text-sm"
                    >
                        📡 添加上游源
                    </button>
                    <button
                        onClick={() => router.push('/admin/logs')}
                        className="bg-purple-50 text-purple-600 px-4 py-3 rounded-lg hover:bg-purple-100 transition-colors font-medium text-sm"
                    >
                        📋 查看日志
                    </button>
                    <button
                        onClick={() => router.push('/admin/settings')}
                        className="bg-gray-50 text-gray-600 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm"
                    >
                        ⚙️ 系统设置
                    </button>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* System Logs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            🔧 最新系统日志
                        </h2>
                        <Link href="/admin/logs?tab=system" className="text-sm text-blue-600 hover:underline">
                            查看全部 →
                        </Link>
                    </div>
                    {stats.latestLogs.system.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4">暂无系统日志</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.latestLogs.system.map((log, idx) => (
                                <div key={idx} className="border-l-2 border-gray-200 pl-3 py-1">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{formatTimestamp(log.timestamp)}</span>
                                        <span className={`px-2 py-0.5 rounded ${log.status === 'success' ? 'bg-green-50 text-green-600' :
                                                log.status === 'failure' ? 'bg-red-50 text-red-600' :
                                                    'bg-gray-50 text-gray-600'
                                            }`}>
                                            {log.category}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-1">{log.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Access Logs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            🌐 最新访问日志
                        </h2>
                        <Link href="/admin/logs?tab=access" className="text-sm text-blue-600 hover:underline">
                            查看全部 →
                        </Link>
                    </div>
                    {stats.latestLogs.access.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4">暂无访问日志</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.latestLogs.access.map((log, idx) => (
                                <div key={idx} className="border-l-2 border-blue-200 pl-3 py-1">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{formatTimestamp(log.timestamp)}</span>
                                        <span className="text-blue-600">{log.username || '匿名'}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-1">
                                        {log.path} <span className="text-gray-400">• {log.userAgent?.substring(0, 30)}...</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
