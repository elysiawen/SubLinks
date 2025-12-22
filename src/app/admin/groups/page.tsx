import { db } from '@/lib/db';
import { getGroupSets } from '@/lib/config-actions';
import AdminGroupsClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminGroupsPage() {
    let groupsBySource: Record<string, any[]> = {};
    let totalCount = 0;
    let error: string | null = null;

    try {
        const allGroups = await db.getProxyGroups();
        totalCount = allGroups.length;

        // Group by source
        for (const group of allGroups) {
            const source = group.source || 'unknown';
            if (!groupsBySource[source]) {
                groupsBySource[source] = [];
            }
            groupsBySource[source].push({
                name: group.name,
                type: group.type,
                proxies: group.proxies,
                ...group.config
            });
        }
    } catch (e: any) {
        error = e.message;
        console.error('Failed to get proxy groups:', e);
    }

    const customSets = await getGroupSets();

    if (error) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">🎯 策略组列表</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">⚠️ 加载失败: {error}</p>
                </div>
            </div>
        );
    }

    return <AdminGroupsClient groupsBySource={groupsBySource} totalCount={totalCount} customSets={customSets} />;
}
