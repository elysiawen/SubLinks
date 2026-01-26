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
    const activeSources = upstreamSources.filter(s => s.enabled !== false).length;
    const defaultSource = upstreamSources.find(s => s.isDefault);

    // Get recent access logs (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const accessLogResult = await db.getAPIAccessLogs(1000, 0); // Get last 1000 logs
    const recentAccessCount = accessLogResult.data.filter((log: any) => log.timestamp > oneDayAgo).length;

    // Get latest logs
    const systemLogResult = await db.getSystemLogs(5, 0); // Get latest 5
    const latestAccessLogResult = await db.getAPIAccessLogs(5, 0); // Get latest 5

    const latestSystemLogs = systemLogResult.data;
    const latestAccessLogs = latestAccessLogResult.data;

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
            active: activeSources,
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
