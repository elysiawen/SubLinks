import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import ServerStatusClient from './client';

export default async function ServerStatusPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== 'admin') {
        redirect('/login');
    }

    return <ServerStatusClient />;
}
