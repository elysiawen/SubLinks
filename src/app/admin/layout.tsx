import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminShell from './shell';

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

    const headersList = await import('next/headers').then(mod => mod.headers());
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || undefined;
    const session = await getSession(sessionId, ip);
    if (!session) {
        redirect('/login?revoked=1');
    }

    if (session.role !== 'admin') {
        redirect('/dashboard'); // or 403
    }

    return (
        <AdminShell username={session.username}>
            {children}
        </AdminShell>
    );
}