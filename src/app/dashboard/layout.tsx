import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import DashboardLayoutClient from './layout-client';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        return <DashboardLayoutClient sessionInvalid>{children}</DashboardLayoutClient>;
    }

    const headersList = await import('next/headers').then(mod => mod.headers());
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || undefined;
    const user = await getSession(sessionId, ip);
    if (!user) {
        return <DashboardLayoutClient sessionInvalid>{children}</DashboardLayoutClient>;
    }

    return <DashboardLayoutClient username={user.username} role={user.role} nickname={user.nickname} avatar={user.avatar}>{children}</DashboardLayoutClient>;
}
