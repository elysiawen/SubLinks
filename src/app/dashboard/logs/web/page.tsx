import { getUserWebAccessLogs } from '@/lib/log-actions';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import WebLogsClient from './client';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WebLogsPage({ searchParams }: PageProps) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/login');
    }

    const resolvedParams = await searchParams;
    const page = Number(resolvedParams.page) || 1;
    const pageSize = Number(resolvedParams.limit) || 10;

    const { logs, total } = await getUserWebAccessLogs(page, pageSize);

    return (
        <WebLogsClient
            logs={logs}
            total={total}
            currentPage={page}
            itemsPerPage={pageSize}
        />
    );
}
