'use server';

import { saveRuleSetAdmin, getAllRuleSetsAdmin } from '@/lib/config-actions';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function saveCustomRule(id: string | null, name: string, content: string, isGlobal: boolean) {
    await saveRuleSetAdmin(id, name, content, isGlobal);
    revalidatePath('/admin/rules/custom');
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard/custom/rules');
    return { success: true };
}

export async function deleteCustomRule(id: string) {
    // Get the config to find userId
    const rules = await getAllRuleSetsAdmin();
    const rule = rules.find(r => r.id === id);
    if (!rule || !rule.userId) {
        throw new Error('配置不存在');
    }
    await db.deleteCustomRule(id, rule.userId);
    revalidatePath('/admin/rules/custom');
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard/custom/rules');
    return { success: true };
}
