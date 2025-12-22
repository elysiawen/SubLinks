import { db } from '@/lib/db';
import UpstreamSourcesClient from './client';

export const dynamic = 'force-dynamic';

export default async function UpstreamSourcesPage() {
    const globalConfig = await db.getGlobalConfig();

    let sources: { name: string; url: string }[] = [];

    if (globalConfig.upstreamSources && Array.isArray(globalConfig.upstreamSources)) {
        sources = globalConfig.upstreamSources;
    } else if (globalConfig.upstreamUrl) {
        // Legacy support
        const urls = Array.isArray(globalConfig.upstreamUrl) ? globalConfig.upstreamUrl : [globalConfig.upstreamUrl];
        sources = urls.map((url, i) => ({
            name: `上游${i + 1}`,
            url: typeof url === 'string' ? url : ''
        }));
    }

    return <UpstreamSourcesClient sources={sources} />;
}
