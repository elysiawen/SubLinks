import { getUserWebAccessLogs } from '@/lib/log-actions';
import { requireSession } from '@/lib/require-session';
import WebLogsClient from './client';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WebLogsPage({ searchParams }: PageProps) {
    const user = await requireSession();
    if (!user) return null;

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
