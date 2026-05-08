import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import SessionsList from './SessionsList';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/auth/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/auth/login');
    }

    const t = await getTranslations('dashboard.sessions');

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border dark:border-zinc-800 pb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-text-primary dark:text-gray-100 tracking-tight">{t('pageTitle')}</h1>
                    <p className="text-sm text-text-tertiary dark:text-zinc-500">
                        {t('pageDesc')}
                    </p>
                </div>
            </div>

            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur opacity-30"></div>
                <div className="relative">
                    <SessionsList />
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <div className="text-[10px] text-text-quaternary dark:text-zinc-600 border-t border-gray-50 dark:border-zinc-800/50 pt-4 w-full text-center">
                    &copy; {new Date().getFullYear()} {t('securityCenter')}
                </div>
            </div>
        </div>
    );
}
