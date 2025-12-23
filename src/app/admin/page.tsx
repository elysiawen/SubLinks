import { getDashboardStats } from './dashboard-actions';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
    const stats = await getDashboardStats();

    return <DashboardClient stats={stats} />;
}
