'use server';

import { saveRuleSetAdmin, getAllRuleSetsAdmin } from '@/lib/config-actions';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-guard';

export async function saveCustomRule(id: string | null, name: string, content: string, isGlobal: boolean) {
    await requireAdmin();
    await saveRuleSetAdmin(id, name, content, isGlobal);
    revalidatePath('/admin/rules/custom');
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard/custom/rules');
    return { success: true };
}

export async function deleteCustomRule(id: string) {
    await requireAdmin();
    // Get the config to find userId
    const rules = await getAllRuleSetsAdmin();
    const rule = rules.find(r => r.id === id);
    if (!rule || !rule.userId) {
        throw new Error('configNotFound');
    }
    await db.deleteCustomRule(id, rule.userId);
    revalidatePath('/admin/rules/custom');
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard/custom/rules');
    return { success: true };
}
