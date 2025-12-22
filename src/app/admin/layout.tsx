import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminSidebar from './sidebar';

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
            <AdminSidebar username={session.username} />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8 max-w-5xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
