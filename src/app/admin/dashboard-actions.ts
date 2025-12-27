'use server';

import { db } from '@/lib/db';

export async function getDashboardStats() {
    // Get all users
    const { data: allUsers } = await db.getAllUsers(1, 10000);
    const activeUsers = allUsers.filter(u => u.status === 'active').length;
    const inactiveUsers = allUsers.filter(u => u.status === 'inactive').length;

    // Get all subscriptions
    const { data: allSubs } = await db.getAllSubscriptions(1, 10000);

    // Get upstream sources
    const upstreamSources = await db.getUpstreamSources();
    const defaultSource = upstreamSources.find(s => s.isDefault);

    // Get recent access logs (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const allAccessLogs = await db.getAPIAccessLogs(1000, 0); // Get last 1000 logs
    const recentAccessCount = allAccessLogs.filter((log: any) => log.timestamp > oneDayAgo).length;

    // Get latest logs
    const systemLogs = await db.getSystemLogs(5, 0); // Get latest 5
    const accessLogs = await db.getAPIAccessLogs(5, 0); // Get latest 5

    const latestSystemLogs = systemLogs;
    const latestAccessLogs = accessLogs;

    return {
        users: {
            total: allUsers.length,
            active: activeUsers,
            inactive: inactiveUsers
        },
        subscriptions: {
            total: allSubs.length,
            active: allSubs.length // All subscriptions are considered active
        },
        upstreamSources: {
            total: upstreamSources.length,
            defaultSource: defaultSource?.name || null
        },
        recentAccess: {
            count24h: recentAccessCount
        },
        latestLogs: {
            system: latestSystemLogs,
            access: latestAccessLogs
        }
    };
}
