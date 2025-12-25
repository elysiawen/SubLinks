import { db } from '@/lib/db';
import UpstreamSourcesClient from './client';

export const dynamic = 'force-dynamic';

export default async function UpstreamSourcesPage() {
    // Get upstream sources from database
    const sources = await db.getUpstreamSources();
    const config = await db.getGlobalConfig();

    return <UpstreamSourcesClient sources={sources} currentApiKey={config.refreshApiKey} />;
}
