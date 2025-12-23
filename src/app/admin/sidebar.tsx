'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/actions';

interface SidebarProps {
    username: string;
}

export default function AdminSidebar({ username }: SidebarProps) {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    const linkClass = (path: string) =>
        `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95 ${isActive(path)
            ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
            : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:translate-x-1'
        }`;

    return (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-100">
                <h1 className="text-xl font-bold text-gray-800">管理后台</h1>
                <p className="text-xs text-gray-400 mt-1">Version 3.0</p>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-2">系统管理</div>
                <Link href="/admin" className={linkClass('/admin')}>
                    📊 概览
                </Link>
                <Link href="/admin/settings" className={linkClass('/admin/settings')}>
                    ⚙️ 全局设置
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">用户</div>
                <Link href="/admin/users" className={linkClass('/admin/users')}>
                    👤 用户管理
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">订阅</div>
                <Link href="/admin/sources" className={linkClass('/admin/sources')}>
                    📡 上游源管理
                </Link>
                <Link href="/admin/subscriptions" className={linkClass('/admin/subscriptions')}>
                    📑 订阅管理
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">订阅内容分析</div>
                <Link href="/admin/proxies" className={linkClass('/admin/proxies')}>
                    🌍 节点列表
                </Link>
                <Link href="/admin/groups" className={linkClass('/admin/groups')}>
                    🤖 策略组
                </Link>
                <Link href="/admin/rules" className={linkClass('/admin/rules')}>
                    📝 分流规则
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">日志</div>
                <Link href="/admin/logs" className={linkClass('/admin/logs')}>
                    📊 日志审计
                </Link>
            </nav>

            <div className="p-4 border-t border-gray-100">
                <div className="px-4 py-2 mb-2 text-xs text-gray-500">
                    当前管理员: <span className="font-bold text-gray-700">{username}</span>
                </div>
                <form action={logout}>
                    <button className="w-full flex items-center justify-center px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                        退出登录
                    </button>
                </form>
            </div>
        </aside>
    );
}
