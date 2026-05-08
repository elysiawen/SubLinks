'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
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
            ? 'bg-accent text-accent-foreground font-semibold shadow-sm'
            : 'text-text-secondary hover:bg-muted hover:text-accent-foreground hover:translate-x-1'
        }`;

    return (
        <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
            <div className="p-6 border-b border-sidebar-border">
                <h1 className="text-xl font-bold text-text-primary">{t('title')}</h1>
                <p className="text-xs text-text-quaternary mt-1">SubLinks</p>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <div className="text-xs font-semibold text-text-quaternary uppercase tracking-wider mb-2 px-4 mt-2">{t('systemManagement')}</div>
                <Link href="/admin" className={linkClass('/admin')}>
                    📊 {t('overview')}
                </Link>
                <Link href="/admin/settings" className={linkClass('/admin/settings')}>
                    ⚙️ {t('globalSettings')}
                </Link>
                <Link href="/admin/status" className={linkClass('/admin/status')}>
                    🖥️ {t('serverStatus')}
                </Link>

                <div className="text-xs font-semibold text-text-quaternary uppercase tracking-wider mb-2 px-4 mt-6">{t('users')}</div>
                <Link href="/admin/users" className={linkClass('/admin/users')}>
                    👤 {t('userManagement')}
                </Link>
                <Link href="/admin/sessions" className={linkClass('/admin/sessions')}>
                    🔑 {t('sessionManagement')}
                </Link>

                <div className="text-xs font-semibold text-text-quaternary uppercase tracking-wider mb-2 px-4 mt-6">{t('subscriptions')}</div>
                <Link href="/admin/sources" className={linkClass('/admin/sources')}>
                    📡 {t('sourceManagement')}
                </Link>
                <Link href="/admin/subscriptions" className={linkClass('/admin/subscriptions')}>
                    📑 {t('subscriptionManagement')}
                </Link>

                <div className="text-xs font-semibold text-text-quaternary uppercase tracking-wider mb-2 px-4 mt-6">{t('contentAnalysis')}</div>
                <Link href="/admin/proxies" className={linkClass('/admin/proxies')}>
                    🌍 {t('proxyList')}
                </Link>
                <Link href="/admin/groups" className={linkClass('/admin/groups')}>
                    🤖 {t('proxyGroups')}
                </Link>
                <Link href="/admin/rules" className={linkClass('/admin/rules')}>
                    ⚡ {t('routingRules')}
                </Link>

                <div className="text-xs font-semibold text-text-quaternary uppercase tracking-wider mb-2 px-4 mt-6">{t('logs')}</div>
                <Link href="/admin/logs" className={linkClass('/admin/logs')}>
                    📊 {t('logAudit')}
                </Link>
            </nav>

            <div className="p-4 border-t border-sidebar-border">
                <div className="px-4 py-2 mb-2 text-xs text-text-tertiary">
                    {t('currentAdmin')}: <span className="font-bold text-text-secondary">{username}</span>
                </div>
                <div className="flex justify-center items-center gap-2 mb-2">
                    <LanguageSwitcher />
                    <div className="w-px h-4 bg-border-strong" />
                    <ThemeToggle />
                </div>
                <Link href="/dashboard" className="w-full flex items-center justify-center px-4 py-2 mb-2 text-sm text-accent-foreground bg-accent rounded-lg hover:bg-accent transition-colors font-medium">
                    🏠 {t('backToDashboard')}
                </Link>

            </div>
        </aside>
    );
}
