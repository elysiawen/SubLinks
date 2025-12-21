import { getParsedConfig } from '@/lib/analysis';
import { getRuleSets } from '@/lib/config-actions';
import AdminRulesClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminRulesPage() {
    const config = await getParsedConfig();
    const defaultRules = config ? (config.rules || []) : [];
    const customSets = await getRuleSets();

    return <AdminRulesClient defaultRules={defaultRules} customSets={customSets} />;
}
