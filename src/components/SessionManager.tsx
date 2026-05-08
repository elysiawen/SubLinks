'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { useTranslations, useLocale } from 'next-intl';
import { useErrors } from '@/lib/use-errors';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import {
    Monitor,
    Smartphone,
    Globe,
    Clock,
    ShieldCheck,
    XCircle,
    LayoutPanelLeft,
    Box,
    User as UserIcon,
    Search,
    RefreshCcw,
    AlertCircle,
    Filter
} from 'lucide-react';

export interface UnifiedSessionItem {
    id: string;
    type: 'web' | 'client';
    userId?: string;
    username?: string;
    nickname?: string;
    ip: string;
    ipLocation?: string;
    isp?: string;
    ua: string;
    deviceInfo?: string; // Parsed device info
    lastActive: number;
    current?: boolean;
    loginMethod?: 'password' | 'qr' | 'passkey';
}

export interface UnifiedSessionManagerProps {
    isAdmin?: boolean;
    fetchSessions: (search?: string) => Promise<{ sessions?: UnifiedSessionItem[]; error?: string; total?: number }>;
    onRevoke: (id: string, type: 'web' | 'client') => Promise<{ success?: boolean; revoked?: boolean; message?: string; error?: string }>;
    title?: string;
    currentSessionId?: string;
}

export function parseUA(ua: string, type: 'web' | 'client') {
    if (!ua || ua === 'unknown') {
        return {
            nameKey: type === 'web' ? 'session.unknownBrowser' : 'session.unknownClient',
            isMobile: false
        };
    }

    let os = '';
    let isMobile = false;
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) { os = 'Android'; isMobile = true; }
    else if (ua.includes('iPhone')) { os = 'iOS'; isMobile = true; }
    else if (ua.includes('iPad')) { os = 'iPadOS'; isMobile = true; }
    else if (ua.includes('Linux')) os = 'Linux';

    let client = '';
    if (ua.includes('Edg/')) client = 'Edge';
    else if (ua.includes('Chrome/')) client = 'Chrome';
    else if (ua.includes('Firefox/')) client = 'Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) client = 'Safari';
    else if (ua.includes('MicroMessenger/')) client = 'session.wechat';
    else if (ua.includes('Clash')) client = 'Clash';
    else if (ua.includes('Shadowrocket')) client = 'Shadowrocket';
    else if (ua.includes('Quantumult')) client = 'Quantumult';
    else if (ua.includes('Stash')) client = 'Stash';
    else if (ua.includes('Surge')) client = 'Surge';
    else if (ua.includes('Loon')) client = 'Loon';
    else if (ua.includes('v2rayN')) client = 'v2rayN';
    else if (ua.includes('v2rayNG')) client = 'v2rayNG';

    const fallbackKey = type === 'web' ? 'session.webFallback' : 'session.clientFallback';
    const nameKey = os && client ? `${os} / ${client.startsWith('session.') ? '' : client}` : (client || os || fallbackKey);
    // If client is a translation key (like 'session.wechat'), return it separately
    const translationKey = client.startsWith('session.') ? client : undefined;

    return { nameKey, nameStatic: os && client && !client.startsWith('session.') ? `${os} / ${client}` : undefined, translationKey, isMobile };
}

export default function SessionManager({
    isAdmin = false,
    fetchSessions,
    onRevoke,
    currentSessionId
}: UnifiedSessionManagerProps) {
    const t = useTranslations('common');
    const locale = useLocale();
    const dateFnsLocale = locale === 'zh' ? zhCN : enUS;
    const [sessions, setSessions] = useState<UnifiedSessionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTypes, setFilterTypes] = useState<('web' | 'client')[]>(['web', 'client']);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { success, error } = useToast();
    const tError = useErrors();
    const { confirm } = useConfirm();

    // Helper to resolve parsed UA name
    const resolveUAName = (info: ReturnType<typeof parseUA>): string => {
        if (info.nameStatic) return info.nameStatic;
        if (info.translationKey) {
            // Handle "os / session.wechat" case
            const parts = info.nameKey.split(' / ');
            if (parts.length === 2) {
                const translatedClient = t(info.translationKey);
                return `${parts[0]} / ${translatedClient}`;
            }
            return t(info.translationKey);
        }
        return t(info.nameKey);
    };

    const loadData = async (search?: string) => {
        setLoading(true);
        try {
            const result = await fetchSessions(search);
            if (result.sessions) {
                setSessions(result.sessions);
            } else if (result.error) {
                error(tError(result.error));
            }
        } catch (err) {
            console.error('Failed to load sessions', err);
            error(t('session.fetchFailed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, isAdmin]);

    const filteredSessions = sessions.filter(s => filterTypes.includes(s.type));

    const toggleFilterType = (type: 'web' | 'client') => {
        setFilterTypes(prev => {
            if (prev.includes(type)) {
                if (prev.length === 1) return prev; // Keep at least one selected
                return prev.filter(t => t !== type);
            }
            return [...prev, type];
        });
    };

    const handleRevokeAction = async (id: string, type: 'web' | 'client', isCurrent?: boolean) => {
        const warning = isAdmin
            ? t('session.revokeConfirmAdmin')
            : t('session.revokeConfirmUser');

        if (!(await confirm(warning, {
            confirmText: t('session.confirmRevoke'),
            confirmColor: 'red'
        }))) return;

        setDeletingId(id);
        try {
            const result = await onRevoke(id, type);
            if (result.success) {
                // If it was revoked (deleted from DB), remove from UI
                if (result.revoked) {
                    setSessions(prev => prev.filter(s => s.id !== id));
                    success(isAdmin ? t('session.sessionForceOffline') : t('session.forceOfflineSuccess'));
                } else {
                    // If backend returned success but nothing was revoked (e.g. already gone)
                    // We still refresh the list to stay in sync
                    loadData(isAdmin ? searchTerm : undefined);
                    error(t('session.sessionNotFound'));
                }
            } else {
                error(result.error ? tError(result.error) : t('session.revokeFailed'));
            }
        } catch (err) {
            error(t('session.networkError'));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-muted/50 rounded-[2.5rem] p-4 sm:p-6 border border-border space-y-5">
                {/* Filter Options */}
                {!loading && sessions.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-1">
                        <div className="flex items-center gap-2 text-text-quaternary">
                            <Filter className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">{t('session.filterSessions')}</span>
                        </div>

                        <div className="flex items-center gap-2 p-1.5 bg-card rounded-2xl border border-border-strong shadow-sm">
                            <button
                                onClick={() => toggleFilterType('web')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                                    filterTypes.includes('web')
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-text-tertiary hover:text-text-secondary hover:bg-muted'
                                }`}
                            >
                                <Monitor className="w-3.5 h-3.5" />
                                <span>{t('session.web')}</span>
                                {filterTypes.includes('web') && (
                                    <span className="flex w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                )}
                            </button>

                            <div className="w-px h-4 bg-border-strong" />

                            <button
                                onClick={() => toggleFilterType('client')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                                    filterTypes.includes('client')
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                        : 'text-text-tertiary hover:text-text-secondary hover:bg-muted'
                                }`}
                            >
                                <Box className="w-3.5 h-3.5" />
                                <span>{t('session.clientAPI')}</span>
                                {filterTypes.includes('client') && (
                                    <span className="flex w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-quaternary group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder={isAdmin ? t('session.searchAdmin') : t('session.searchUser')}
                        className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-medium text-sm shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <RefreshCcw className="w-10 h-10 text-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-text-quaternary font-medium animate-pulse">{t('session.loading')}</p>
                </div>
            ) : filteredSessions.length === 0 ? (
                <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed border-border-strong">
                    <ShieldCheck className="w-16 h-16 text-text-quaternary mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-text-primary">{t('session.noSessions')}</h3>
                    <p className="text-sm text-text-tertiary mt-2">{t('session.noSessionsDesc')}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredSessions.map(session => {
                        const info = parseUA(session.ua, session.type);
                        const isCurrent = session.current || session.id === currentSessionId;

                        return (
                            <div
                                key={session.id}
                                className={`group relative flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 sm:p-5 bg-card rounded-3xl border transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-black/20 ${isCurrent
                                    ? 'border-blue-500/30 bg-blue-50/10 dark:bg-blue-900/10 shadow-sm shadow-blue-500/5'
                                    : 'border-border hover:border-blue-200 dark:hover:border-blue-900/40'
                                    }`}
                            >
                                <div className="flex items-start lg:items-center gap-3 sm:gap-5 w-full">
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${isCurrent
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-muted border-border text-text-quaternary group-hover:bg-card group-hover:text-blue-600 group-hover:border-blue-200 dark:group-hover:border-blue-900/50 group-hover:scale-105'
                                        }`}>
                                        {session.type === 'client' ? (
                                            <Box className="w-6 h-6 sm:w-7 sm:h-7" />
                                        ) : info.isMobile ? (
                                            <Smartphone className="w-6 h-6 sm:w-7 sm:h-7" />
                                        ) : (
                                            <Monitor className="w-6 h-6 sm:w-7 sm:h-7" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            {isAdmin && session.username && (
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-lg whitespace-nowrap">
                                                    <UserIcon className="w-3.5 h-3.5 text-text-tertiary" />
                                                    <span className="text-sm font-black text-text-primary">{session.username}</span>
                                                </div>
                                            )}
                                            <h4 className="font-bold text-text-primary text-lg tracking-tight break-all sm:break-normal whitespace-normal sm:whitespace-nowrap leading-snug">
                                                {session.deviceInfo && session.deviceInfo !== session.ua ? session.deviceInfo : resolveUAName(info)}
                                            </h4>
                                            {isCurrent && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold bg-green-500 text-white dark:bg-green-500/20 dark:text-green-400 rounded-full whitespace-nowrap">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    {t('session.currentDevice')}
                                                </span>
                                            )}
                                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${session.type === 'web'
                                                ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20'
                                                : 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20'
                                                }`}>
                                                {session.type === 'web' ? (isAdmin ? t('session.webTag') : t('session.web')) : (isAdmin ? t('session.apiTag') : t('session.clientAPI'))}
                                            </span>
                                            {session.loginMethod && (
                                                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${session.loginMethod === 'passkey'
                                                    ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20'
                                                    : session.loginMethod === 'qr'
                                                        ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20'
                                                        : 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/20'
                                                    }`}>
                                                    {t(`session.${session.loginMethod}`)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-4 text-xs text-text-tertiary flex-wrap">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <Globe className="w-4 h-4 text-blue-500/60" />
                                                        <span className="font-mono font-medium">{session.ip}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {session.ipLocation && (
                                                            <span className="px-1.5 py-0.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md font-sans border border-indigo-100 dark:border-indigo-800/30 whitespace-nowrap">
                                                                {session.ipLocation}
                                                            </span>
                                                        )}
                                                        {session.isp && (
                                                            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md font-sans border border-emerald-100 dark:border-emerald-800/30 truncate max-w-[150px] sm:max-w-xs" title={session.isp}>
                                                                {session.isp}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div
                                                    className="flex items-center gap-1.5 group/time cursor-pointer outline-none active:scale-95 transition-transform"
                                                    tabIndex={0}
                                                >
                                                    <Clock className="w-4 h-4 text-orange-500/60" />
                                                    <span className="block group-hover/time:hidden group-focus/time:hidden">{formatDistanceToNow(session.lastActive, { addSuffix: true, locale: dateFnsLocale })} {t('session.active')}</span>
                                                    <span className="hidden group-hover/time:block group-focus/time:block">{format(session.lastActive, 'yyyy-MM-dd HH:mm:ss')} {t('session.active')}</span>
                                                </div>
                                            </div>

                                            {/* UA with Tooltip */}
                                            <div className="group/ua relative">
                                                <div className="flex items-center gap-1.5 text-[10px] text-text-quaternary font-mono transition-colors group-hover:text-text-tertiary cursor-help">
                                                    <LayoutPanelLeft className="w-3.5 h-3.5 flex-shrink-0" />
                                                    <span className="truncate max-w-[200px] sm:max-w-md md:max-w-lg">{session.ua}</span>
                                                </div>
                                                <div className="absolute bottom-full left-0 mb-2 invisible group-hover/ua:visible bg-zinc-900 text-zinc-100 text-[10px] p-3 rounded-xl w-72 break-all shadow-2xl z-30 border border-zinc-700 whitespace-normal leading-relaxed">
                                                    <div className="font-bold text-text-quaternary mb-1 border-b border-zinc-700 pb-1">{t('session.fullUA')}</div>
                                                    {session.ua}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className={`flex items-center justify-end w-full lg:w-auto lg:mt-0 lg:pt-0 lg:border-t-0 border-border ${!isCurrent ? 'mt-5 pt-4 border-t' : 'mt-2'}`}>
                                    {!isCurrent ? (
                                        <button
                                            onClick={() => handleRevokeAction(session.id, session.type, isCurrent)}
                                            disabled={deletingId === session.id}
                                            className="w-full lg:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-red-600 bg-red-50/50 dark:bg-red-500/5 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white rounded-2xl transition-all duration-300 disabled:opacity-50 border border-red-100/50 dark:border-red-900/20 active:scale-95 whitespace-nowrap"
                                        >
                                            {deletingId === session.id ? (
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <XCircle className="w-4 h-4" />
                                            )}
                                            <span>{isAdmin ? t('session.forceLogout') : t('session.forceOffline')}</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-[10px] text-text-quaternary font-medium px-4 whitespace-nowrap">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            {t('session.protectedSession')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Security Footer Info */}
            {!isAdmin && (
                <div className="flex items-start gap-3 p-4 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 rounded-2xl mt-6">
                    <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-300">{t('session.securityTip')}</p>
                        <p className="text-[11px] text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
                            {t('session.securityTipDesc')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
