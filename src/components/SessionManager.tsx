'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
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
    AlertCircle
} from 'lucide-react';

export interface UnifiedSessionItem {
    id: string;
    type: 'web' | 'client';
    userId?: string;
    username?: string;
    nickname?: string;
    ip: string;
    ua: string;
    deviceInfo?: string;
    lastActive: number;
    current?: boolean;
}

export interface UnifiedSessionManagerProps {
    isAdmin?: boolean;
    fetchSessions: (search?: string) => Promise<{ sessions?: UnifiedSessionItem[]; error?: string; total?: number }>;
    onRevoke: (id: string, type: 'web' | 'client') => Promise<{ success?: boolean; error?: string }>;
    title?: string;
    currentSessionId?: string;
}

export function parseUA(ua: string, type: 'web' | 'client') {
    if (!ua || ua === 'unknown') {
        return {
            name: type === 'web' ? '未知浏览器' : '未知客户端',
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
    else if (ua.includes('MicroMessenger/')) client = '微信';
    else if (ua.includes('Clash')) client = 'Clash';
    else if (ua.includes('Shadowrocket')) client = 'Shadowrocket';
    else if (ua.includes('Quantumult')) client = 'Quantumult';
    else if (ua.includes('Stash')) client = 'Stash';
    else if (ua.includes('Surge')) client = 'Surge';
    else if (ua.includes('Loon')) client = 'Loon';
    else if (ua.includes('v2rayN')) client = 'v2rayN';
    else if (ua.includes('v2rayNG')) client = 'v2rayNG';

    const name = os && client ? `${os} / ${client}` : (client || os || (type === 'web' ? '网页端' : '客户端'));

    return { name, isMobile };
}

export default function SessionManager({
    isAdmin = false,
    fetchSessions,
    onRevoke,
    currentSessionId
}: UnifiedSessionManagerProps) {
    const [sessions, setSessions] = useState<UnifiedSessionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    const loadData = async (search?: string) => {
        setLoading(true);
        try {
            const result = await fetchSessions(search);
            if (result.sessions) {
                setSessions(result.sessions);
            } else if (result.error) {
                error(result.error);
            }
        } catch (err) {
            console.error('Failed to load sessions', err);
            error('获取会话列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAdmin) {
            loadData();
        } else {
            const timer = setTimeout(() => {
                loadData(searchTerm);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [searchTerm, isAdmin]);

    const handleRevokeAction = async (id: string, type: 'web' | 'client', isCurrent?: boolean) => {
        const warning = isAdmin
            ? '管理员确认：确定要强制注销该用户的该次会话吗？'
            : '安全警示：确定要强制注销该设备的登录状态吗？此操作将立即中断该设备的所有活跃会话。';

        if (!(await confirm(warning, {
            confirmText: '确认注销',
            confirmColor: 'red'
        }))) return;

        setDeletingId(id);
        try {
            const result = await onRevoke(id, type);
            if (result.success) {
                setSessions(prev => prev.filter(s => s.id !== id));
                success(isAdmin ? '会话已强制下线' : '强制下线命令已发出，设备将立即退出。');
            } else {
                error(result.error || '注销失败');
            }
        } catch (err) {
            error('操作失败，请检查网络');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Search Bar (Admin Only) */}
            {isAdmin && (
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="搜索用户名、IP 或 设备名..."
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-medium text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <RefreshCcw className="w-10 h-10 text-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 font-medium animate-pulse">正在获取安全会话数据...</p>
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-20 bg-gray-50/30 dark:bg-zinc-900/10 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
                    <ShieldCheck className="w-16 h-16 text-gray-300 dark:text-zinc-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">无活跃会话</h3>
                    <p className="text-sm text-gray-500 mt-2">目前没有任何符合条件的登录记录。</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {sessions.map(session => {
                        const info = parseUA(session.ua, session.type);
                        const isCurrent = session.current || session.id === currentSessionId;

                        return (
                            <div
                                key={session.id}
                                className={`group relative flex flex-col lg:flex-row items-start lg:items-center justify-between p-5 bg-white dark:bg-zinc-900/40 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-black/20 ${isCurrent
                                    ? 'border-blue-500/30 bg-blue-50/10 dark:bg-blue-900/10 shadow-sm shadow-blue-500/5'
                                    : 'border-gray-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-900/40'
                                    }`}
                            >
                                <div className="flex items-start lg:items-center gap-5 w-full">
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${isCurrent
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700 text-gray-400 dark:text-gray-500 group-hover:bg-white dark:group-hover:bg-zinc-700 group-hover:text-blue-600 group-hover:border-blue-200 dark:group-hover:border-blue-900/50 group-hover:scale-105'
                                        }`}>
                                        {session.type === 'client' ? (
                                            <Box className="w-7 h-7" />
                                        ) : info.isMobile ? (
                                            <Smartphone className="w-7 h-7" />
                                        ) : (
                                            <Monitor className="w-7 h-7" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            {isAdmin && session.username && (
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg whitespace-nowrap">
                                                    <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                                                    <span className="text-sm font-black text-gray-900 dark:text-gray-100">{session.username}</span>
                                                </div>
                                            )}
                                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg tracking-tight whitespace-nowrap">
                                                {info.name}
                                            </h4>
                                            {isCurrent && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold bg-green-500 text-white dark:bg-green-500/20 dark:text-green-400 rounded-full whitespace-nowrap">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    当前设备
                                                </span>
                                            )}
                                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${session.type === 'web'
                                                ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20'
                                                : 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20'
                                                }`}>
                                                {session.type === 'web' ? (isAdmin ? 'Web' : '网页端') : (isAdmin ? 'API' : '客户端 API')}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Globe className="w-4 h-4 text-blue-500/60" />
                                                    <span className="font-mono font-medium">{session.ip}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-4 h-4 text-orange-500/60" />
                                                    <span>{formatDistanceToNow(session.lastActive, { addSuffix: true, locale: zhCN })}活跃</span>
                                                </div>
                                            </div>

                                            {/* UA with Tooltip */}
                                            <div className="group/ua relative">
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-zinc-500 font-mono transition-colors group-hover:text-gray-500 dark:group-hover:text-zinc-400 cursor-help">
                                                    <LayoutPanelLeft className="w-3.5 h-3.5 flex-shrink-0" />
                                                    <span className="truncate max-w-[200px] sm:max-w-md md:max-w-lg">{session.ua}</span>
                                                </div>
                                                <div className="absolute bottom-full left-0 mb-2 invisible group-hover/ua:visible bg-zinc-900 text-zinc-100 text-[10px] p-3 rounded-xl w-72 break-all shadow-2xl z-30 border border-zinc-700 whitespace-normal leading-relaxed">
                                                    <div className="font-bold text-gray-400 mb-1 border-b border-zinc-700 pb-1">完整 User Agent</div>
                                                    {session.ua}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className={`flex items-center justify-end w-full lg:w-auto lg:mt-0 lg:pt-0 lg:border-t-0 border-gray-100 dark:border-zinc-800/60 ${!isCurrent ? 'mt-5 pt-4 border-t' : 'mt-2'}`}>
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
                                            <span>{isAdmin ? '强制登出' : '强制下线'}</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-zinc-600 font-medium px-4 whitespace-nowrap">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            受保护的当前会话
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
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-300">安全防护提示</p>
                        <p className="text-[11px] text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
                            系统会实时监控登录状态。如果您在列表中发现非本人操作的设备或异常 IP 位置，请先点击“强制下线”，并立即更您的登录密码。
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
