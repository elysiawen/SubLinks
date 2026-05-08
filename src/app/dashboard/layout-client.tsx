'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ToastProvider } from '@/components/ToastProvider';
import { ConfirmProvider, useConfirm } from '@/components/ConfirmProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslations } from 'next-intl';

interface DashboardLayoutClientProps {
    children: React.ReactNode;
    username: string;
    role: string;
    nickname?: string;
    avatar?: string;
}

interface NavItemProps {
    href?: string;
    label: string;
    icon: string;
    isActive: boolean;
    hasSubmenu?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    children?: React.ReactNode;
    onItemClick?: () => void;
}

const SidebarItem = ({ href, label, icon, isActive, hasSubmenu, isOpen, onToggle, children, onItemClick }: NavItemProps) => {
    if (hasSubmenu) {
        return (
            <div className="space-y-1">
                <button
                    onClick={onToggle}
                    className={`
                        w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group
                        ${isActive
                            ? 'bg-accent text-accent-foreground font-medium shadow-sm ring-1 ring-accent'
                            : 'text-sidebar-foreground hover:bg-muted hover:text-text-primary'
                        }
                    `}
                >
                    <div className="flex items-center gap-3">
                        <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
                        <span className="text-[15px]">{label}</span>
                    </div>
                    <svg
                        className={`w-4 h-4 transition-all duration-200 text-text-quaternary ${isOpen ? 'rotate-180 text-accent-foreground' : 'group-hover:text-sidebar-foreground'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                <div
                    className={`
                        overflow-hidden transition-all duration-300 ease-in-out
                        ${isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}
                    `}
                >
                    <div className="pl-12 pr-2 space-y-1 py-1 relative before:absolute before:left-[29px] before:top-2 before:bottom-2 before:w-px before:bg-border-strong">
                        {children}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Link
            href={href!}
            onClick={onItemClick}
            className={`
                flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group
                ${isActive
                    ? 'bg-accent text-accent-foreground font-medium shadow-sm ring-1 ring-accent'
                    : 'text-sidebar-foreground hover:bg-muted hover:text-text-primary'
                }
            `}
        >
            <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
            <span className="text-[15px]">{label}</span>
        </Link>
    );
};

const SidebarSubItem = ({ href, label, isActive, onItemClick }: { href: string; label: string; isActive: boolean; onItemClick?: () => void }) => (
    <Link
        href={href}
        onClick={onItemClick}
        className={`
            block px-3 py-2 rounded-lg text-[13px] transition-all duration-200 relative
            ${isActive
                ? 'text-accent-foreground bg-accent/50 font-medium translate-x-1'
                : 'text-text-tertiary hover:text-text-primary hover:bg-muted hover:translate-x-1'
            }
        `}
    >
        {label}
    </Link>
);

export default function DashboardLayoutClient({ children, username, role, nickname, avatar }: DashboardLayoutClientProps) {
    const pathname = usePathname();
    const { confirm } = useConfirm();
    const t = useTranslations('dashboard.sidebar');
    const tCommon = useTranslations('common.status');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // Initialize with open submenus if current path matches
    const [openSubmenus, setOpenSubmenus] = useState<string[]>(() => {
        const initial: string[] = [];
        if (pathname.startsWith('/dashboard/custom')) initial.push('custom');
        if (pathname.startsWith('/dashboard/logs')) initial.push('logs');
        return initial;
    });

    const toggleSubmenu = (key: string) => {
        setOpenSubmenus(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleItemClick = () => {
        setIsSidebarOpen(false);
    };

    return (
        <ToastProvider>
            <ConfirmProvider>
                <div className="min-h-screen bg-muted">
                    {/* Mobile Header */}
                    <div className="lg:hidden bg-card/80 backdrop-blur-md border-b border-border-strong p-4 flex items-center sticky top-0 z-40 gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 rounded-xl hover:bg-muted transition-colors active:scale-95 duration-200 -ml-2"
                        >
                            <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <img
                                src="/favicon.ico"
                                alt="Logo"
                                className="w-8 h-8 rounded-lg shadow-sm"
                            />
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-text-primary to-text-secondary">
                                SubLinks
                            </h1>
                        </div>
                    </div>

                    {/* Sidebar Overlay (Mobile) */}
                    {isSidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}

                    <div className="flex">
                        {/* Sidebar */}
                        <aside
                            className={`
                        fixed lg:sticky top-0 left-0 h-screen w-[280px] bg-sidebar border-r border-sidebar-border
                        transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) z-50 lg:z-0
                        shadow-[4px_0_24px_-4px_rgba(0,0,0,0.02)]
                        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    `}
                        >
                            <div className="flex flex-col h-full">
                                {/* Logo/Title */}
                                <div className="p-6">
                                    <div className="flex items-center gap-3 px-2">
                                        <img
                                            src="/favicon.ico"
                                            alt="Logo"
                                            className="w-10 h-10 rounded-xl shadow-lg transform transition-transform hover:scale-105 duration-300"
                                        />
                                        <div>
                                            <h1 className="text-xl font-bold text-text-primary tracking-tight">SubLinks</h1>
                                            <p className="text-[10px] uppercase font-bold text-accent-foreground tracking-widest mt-0.5">Dashboard</p>
                                        </div>
                                    </div>
                                </div>

                                {/* User Profile Card */}
                                <div className="px-4 mb-4">
                                    <div className="p-3 bg-gradient-to-br from-muted to-card rounded-xl border border-border flex items-center gap-3 shadow-sm group hover:shadow-md transition-all duration-300">
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-text-tertiary text-sm font-semibold border-2 border-card ring-1 ring-border overflow-hidden">
                                            {avatar ? (
                                                <img src={avatar} alt="头像" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{(nickname || username).slice(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-text-primary truncate">{nickname || username}</p>
                                            <p className="text-xs text-text-tertiary truncate flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                                                {tCommon('connected')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Navigation */}
                                <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pb-6">
                                    <div className="px-3 pb-2 pt-1">
                                        <p className="text-[11px] font-bold text-text-quaternary uppercase tracking-wider">{t('mainFeatures')}</p>
                                    </div>

                                    <SidebarItem
                                        icon="📊"
                                        label={t('overview')}
                                        href="/dashboard"
                                        isActive={pathname === '/dashboard'}
                                        onItemClick={handleItemClick}
                                    />
                                    <SidebarItem
                                        icon="📋"
                                        label={t('subscriptionCenter')}
                                        href="/dashboard/subscriptions"
                                        isActive={pathname === '/dashboard/subscriptions'}
                                        onItemClick={handleItemClick}
                                    />
                                    <SidebarItem
                                        icon="📚"
                                        label={t('tutorial')}
                                        href="/dashboard/tutorial"
                                        isActive={pathname === '/dashboard/tutorial'}
                                        onItemClick={handleItemClick}
                                    />

                                    <div className="px-3 pb-2 pt-4">
                                        <p className="text-[11px] font-bold text-text-quaternary uppercase tracking-wider">{t('advancedConfig')}</p>
                                    </div>

                                    <SidebarItem
                                        icon="📦"
                                        label={t('customConfig')}
                                        isActive={pathname.startsWith('/dashboard/custom')}
                                        hasSubmenu
                                        isOpen={openSubmenus.includes('custom')}
                                        onToggle={() => toggleSubmenu('custom')}
                                    >
                                        <SidebarSubItem
                                            label={t('customGroups')}
                                            href="/dashboard/custom/groups"
                                            isActive={pathname === '/dashboard/custom/groups'}
                                            onItemClick={handleItemClick}
                                        />
                                        <SidebarSubItem
                                            label={t('customRules')}
                                            href="/dashboard/custom/rules"
                                            isActive={pathname === '/dashboard/custom/rules'}
                                            onItemClick={handleItemClick}
                                        />
                                    </SidebarItem>

                                    <SidebarItem
                                        icon="📜"
                                        label={t('operationLogs')}
                                        isActive={pathname.startsWith('/dashboard/logs')}
                                        hasSubmenu
                                        isOpen={openSubmenus.includes('logs')}
                                        onToggle={() => toggleSubmenu('logs')}
                                    >
                                        <SidebarSubItem
                                            label={t('subscriptionLogs')}
                                            href="/dashboard/logs/subscription"
                                            isActive={pathname === '/dashboard/logs/subscription'}
                                            onItemClick={handleItemClick}
                                        />
                                        <SidebarSubItem
                                            label={t('accessLogs')}
                                            href="/dashboard/logs/web"
                                            isActive={pathname === '/dashboard/logs/web'}
                                            onItemClick={handleItemClick}
                                        />
                                    </SidebarItem>

                                    <div className="my-4 h-px bg-border mx-2" />

                                    <SidebarItem
                                        icon="⚙️"
                                        label={t('accountSettings')}
                                        href="/dashboard/settings"
                                        isActive={pathname === '/dashboard/settings'}
                                        onItemClick={handleItemClick}
                                    />
                                    <SidebarItem
                                        icon="📱"
                                        label={t('sessionManagement')}
                                        href="/dashboard/sessions"
                                        isActive={pathname === '/dashboard/sessions'}
                                        onItemClick={handleItemClick}
                                    />
                                </nav>

                                {/* Footer / Logout */}
                                <div className="p-4 border-t border-sidebar-border bg-muted/50 space-y-2">
                                    <div className="flex justify-center items-center gap-2 mb-1">
                                        <LanguageSwitcher />
                                        <div className="w-px h-4 bg-border-strong" />
                                        <ThemeToggle />
                                    </div>
                                    {role === 'admin' && (
                                        <Link
                                            href="/admin"
                                            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-[14px] font-medium text-accent-foreground bg-accent border border-accent/60 rounded-xl hover:bg-accent-foreground/10 hover:border-accent-foreground/30 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
                                        >
                                            <span className="group-hover:scale-110 transition-transform duration-200">🛡️</span>
                                            <span>{t('adminPanel')}</span>
                                        </Link>
                                    )}
                                    <button
                                        onClick={() => {
                                            confirm(t('logoutConfirm'), {
                                                confirmText: t('logoutButton'),
                                                confirmColor: 'red',
                                                onConfirm: async () => {
                                                    const { logout } = await import('@/lib/actions');
                                                    await logout();
                                                }
                                            });
                                        }}
                                        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-[14px] font-medium text-destructive bg-card border border-border-strong/60 rounded-xl hover:bg-error hover:border-error hover:text-destructive-foreground hover:shadow-sm transition-all duration-200 group"
                                    >
                                        <span className="group-hover:-translate-x-0.5 transition-transform duration-200">🚪</span>
                                        <span>{t('logout')}</span>
                                    </button>
                                </div>
                            </div>
                        </aside>

                        {/* Main Content */}
                        <main className="flex-1 lg:ml-0 min-w-0 transition-all duration-300">
                            {children}
                        </main>
                    </div>
                </div>
            </ConfirmProvider>
        </ToastProvider>
    );
}
