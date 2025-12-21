import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== 'admin') {
        redirect('/dashboard'); // or 403
    }

    return (
        <div className="min-h-screen bg-gray-50 flex font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-gray-800">管理后台</h1>
                    <p className="text-xs text-gray-400 mt-1">Version 3.0</p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-2">系统管理</div>
                    <Link href="/admin/users" className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors">
                        👤 用户管理
                    </Link>
                    <Link href="/admin/settings" className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors">
                        ⚙️ 全局设置
                    </Link>

                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-6">订阅内容分析</div>
                    <Link href="/admin/proxies" className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors">
                        🌍 节点列表
                    </Link>
                    <Link href="/admin/groups" className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors">
                        🤖 策略组
                    </Link>
                    <Link href="/admin/rules" className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors">
                        📝 分流规则
                    </Link>
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="px-4 py-2 mb-2 text-xs text-gray-500">
                        当前管理员: <span className="font-bold text-gray-700">{session.username}</span>
                    </div>
                    <form action={async () => {
                        'use server';
                        const { logout } = await import('@/lib/actions');
                        await logout();
                    }}>
                        <button className="w-full flex items-center justify-center px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                            退出登录
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8 max-w-5xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
