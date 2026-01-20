import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SessionsList from './SessionsList';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/login');
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-100 dark:border-zinc-800 pb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">登录设备管理</h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-500">
                        实时监控并对异常的活跃会话执行强制下线操作
                    </p>
                </div>
            </div>

            <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur opacity-30"></div>
                <div className="relative">
                    <SessionsList />
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <div className="text-[10px] text-gray-400 dark:text-zinc-600 border-t border-gray-50 dark:border-zinc-800/50 pt-4 w-full text-center">
                    &copy; {new Date().getFullYear()} SubLinks 安全中心 &middot; 工业级会话加密保护
                </div>
            </div>
        </div>
    );
}
