import { db } from '@/lib/db';
import CustomRulesClient from './client';

export const dynamic = 'force-dynamic';

export default async function CustomRulesPage() {
    const customRules = await db.getCustomRules();

    return <CustomRulesClient customRules={customRules} />;
}
