import AdminSessionsList from './AdminSessionsList';
import { ShieldCheck, Activity } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function AdminSessionsPage() {
    const t = await getTranslations('admin.sessions');

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header section with Stats concept */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border dark:border-zinc-800 pb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">
                        <Activity className="w-3 h-3" />
                        {t('securityLevel')}
                    </div>
                    <h1 className="text-4xl font-black text-text-primary dark:text-gray-100 tracking-tight">{t('pageTitle')}</h1>
                    <p className="text-sm text-text-tertiary dark:text-zinc-500 max-w-md">
                        {t('pageDesc')}
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-accent/50 dark:bg-blue-900/10 p-4 rounded-3xl border border-blue-100/50 dark:border-blue-900/20">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-blue-900/40 dark:text-blue-400/40 uppercase tracking-tighter">{t('securityLevel')}</div>
                        <div className="text-xl font-black text-accent-foreground tracking-tighter">{t('enterpriseReady')}</div>
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
            <div className="flex flex-col items-center gap-4 pt-8 border-t border-muted dark:border-zinc-800/50">
                <div className="flex items-center gap-2 text-[10px] text-text-quaternary dark:text-zinc-600 font-medium">
                    <span>{t('auditActive')}</span>
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                </div>
                <p className="text-[10px] text-gray-300 dark:text-zinc-700 text-center max-w-xl leading-relaxed">
                    {t('adminTip')}
                </p>
            </div>
        </div>
    );
}
