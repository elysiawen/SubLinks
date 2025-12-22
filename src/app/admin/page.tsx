import { getDashboardStats } from './dashboard-actions';
import DashboardClient from './dashboard-client';

export default async function AdminDashboardPage() {
    const stats = await getDashboardStats();

    return <DashboardClient stats={stats} />;
}
