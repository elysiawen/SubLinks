'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';


interface SidebarProps {
    username: string;
}

export default function AdminSidebar({ username }: SidebarProps) {
    const pathname = usePathname();
    const t = useTranslations('admin.sidebar');


    const isActive = (path: string) => pathname === path;

    const linkClass = (path: string) =>
        `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95 ${isActive(path)
            ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
            : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:translate-x-1'
        }`;

    return (
        <aside className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-100">
                <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
                <p className="text-xs text-gray-400 mt-1">SubLinks</p>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-2">{t('systemManagement')}</div>
                <Link href="/admin" className={linkClass('/admin')}>
                    📊 {t('overview')}
                </Link>
                <Link href="/admin/settings" className={linkClass('/admin/settings')}>
                    ⚙️ {t('globalSettings')}
                </Link>
                <Link href="/admin/status" className={linkClass('/admin/status')}>
                    🖥️ {t('serverStatus')}
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">{t('users')}</div>
                <Link href="/admin/users" className={linkClass('/admin/users')}>
                    👤 {t('userManagement')}
                </Link>
                <Link href="/admin/sessions" className={linkClass('/admin/sessions')}>
                    🔑 {t('sessionManagement')}
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">{t('subscriptions')}</div>
                <Link href="/admin/sources" className={linkClass('/admin/sources')}>
                    📡 {t('sourceManagement')}
                </Link>
                <Link href="/admin/subscriptions" className={linkClass('/admin/subscriptions')}>
                    📑 {t('subscriptionManagement')}
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">{t('contentAnalysis')}</div>
                <Link href="/admin/proxies" className={linkClass('/admin/proxies')}>
                    🌍 {t('proxyList')}
                </Link>
                <Link href="/admin/groups" className={linkClass('/admin/groups')}>
                    🤖 {t('proxyGroups')}
                </Link>
                <Link href="/admin/rules" className={linkClass('/admin/rules')}>
                    ⚡ {t('routingRules')}
                </Link>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">{t('logs')}</div>
                <Link href="/admin/logs" className={linkClass('/admin/logs')}>
                    📊 {t('logAudit')}
                </Link>
            </nav>

            <div className="p-4 border-t border-gray-100">
                <div className="px-4 py-2 mb-2 text-xs text-gray-500">
                    {t('currentAdmin')}: <span className="font-bold text-gray-700">{username}</span>
                </div>
                <div className="flex justify-center mb-2">
                    <LanguageSwitcher />
                </div>
                <Link href="/dashboard" className="w-full flex items-center justify-center px-4 py-2 mb-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                    🏠 {t('backToDashboard')}
                </Link>

            </div>
        </aside>
    );
}
