import { getUsers } from '../actions';
import AdminUsersClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    const users = await getUsers();
    return <AdminUsersClient users={users} />;
}
