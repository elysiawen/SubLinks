import { db } from '@/lib/db';
import AdminProxiesClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminProxiesPage() {
    let proxiesBySource: Record<string, any[]> = {};
    let totalCount = 0;
    let error: string | null = null;

    try {
        const allProxies = await db.getProxies();
        totalCount = allProxies.length;

        // Group proxies by source
        for (const proxy of allProxies) {
            const source = proxy.source || 'unknown';
            if (!proxiesBySource[source]) {
                proxiesBySource[source] = [];
            }
            proxiesBySource[source].push(proxy.config);
        }
    } catch (e: any) {
        error = e.message;
        console.error('Failed to get proxies:', e);
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">🌍 节点列表</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">⚠️ 加载失败: {error}</p>
                </div>
            </div>
        );
    }

    return <AdminProxiesClient proxiesBySource={proxiesBySource} totalCount={totalCount} />;
}
