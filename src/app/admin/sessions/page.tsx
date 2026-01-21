import AdminSessionsList from './AdminSessionsList';
import { ShieldCheck, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminSessionsPage() {
    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header section with Stats concept */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">
                        <Activity className="w-3 h-3" />
                        Infrastructure Security
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight">全站会话审计</h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-500 max-w-md">
                        监控全球范围内的活跃登录会话，您可以实时管理所有用户对系统的访问权限，并在发现异常时执行全系统吊销动作。
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-3xl border border-blue-100/50 dark:border-blue-900/20">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-blue-900/40 dark:text-blue-400/40 uppercase tracking-tighter">Security Level</div>
                        <div className="text-xl font-black text-blue-600 tracking-tighter">Enterpise Ready</div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="relative overflow-hidden">
                {/* Decorative background element for premium feel */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative">
                    <AdminSessionsList />
                </div>
            </div>

            {/* Footer with legal/security disclaimer */}
            <div className="flex flex-col items-center gap-4 pt-8 border-t border-gray-50 dark:border-zinc-800/50">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-600 font-medium">
                    <span>SECURITY AUDIT LOG ACTIVE</span>
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                </div>
                <p className="text-[10px] text-gray-300 dark:text-zinc-700 text-center max-w-xl leading-relaxed">
                    管理员提示：会话审计操作会被全量记录在系统审计日志中。请遵循数据隐私保护原则，仅在排查安全隐患或协助用户处理异常登录时使用强制登出功能。
                </p>
            </div>
        </div>
    );
}
