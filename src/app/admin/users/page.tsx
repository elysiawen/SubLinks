import { getUsers } from '../actions';
import AdminUsersClient from './client';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    const users = await getUsers();
    const config = await db.getGlobalConfig();
    return <AdminUsersClient users={users} globalMaxSubs={config.maxUserSubscriptions || 10} />;
}
