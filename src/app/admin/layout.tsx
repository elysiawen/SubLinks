import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import AdminShell from './shell';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        return <AdminShell sessionInvalid>{children}</AdminShell>;
    }

    const headersList = await import('next/headers').then(mod => mod.headers());
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || undefined;
    const session = await getSession(sessionId, ip);
    if (!session) {
        return <AdminShell sessionInvalid>{children}</AdminShell>;
    }

    if (session.role !== 'admin') {
        return <AdminShell sessionInvalid redirectPath="/dashboard">{children}</AdminShell>;
    }

    return (
        <AdminShell username={session.username}>
            {children}
        </AdminShell>
    );
}
