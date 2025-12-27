import { getUsers } from '../actions';
import AdminUsersClient from './client';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string; limit?: string; search?: string }> }) {
    const params = await searchParams;
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '10');
    const search = params.search || undefined;

    const { data: users, total } = await getUsers(page, limit, search);
    const config = await db.getGlobalConfig();

    return (
        <AdminUsersClient
            users={users}
            total={total}
            currentPage={page}
            itemsPerPage={limit}
            globalMaxSubs={config.maxUserSubscriptions || 10}
        />
    );
}
