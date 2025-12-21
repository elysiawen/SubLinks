import { getSession } from '@/lib/auth';
import { getUserSubscriptions } from '@/lib/sub-actions';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from './client';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
    const sessionId = (await cookies()).get('auth_session')?.value;
    if (!sessionId) redirect('/login');
    const session = await getSession(sessionId);
    if (!session) redirect('/login');

    const subs = await getUserSubscriptions();
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    return <DashboardClient initialSubs={subs} username={session.username} baseUrl={baseUrl} />;
}
