import { getAllRuleSetsAdmin } from '@/lib/config-actions';
import CustomRulesClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomRulesPage() {
    const customRules = await getAllRuleSetsAdmin();

    return <CustomRulesClient customRules={customRules} />;
}
