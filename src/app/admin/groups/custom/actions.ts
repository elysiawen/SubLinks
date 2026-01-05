'use server';

import { saveGroupSetAdmin, getAllGroupSetsAdmin } from '@/lib/config-actions';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function saveCustomGroup(id: string | null, name: string, content: string, isGlobal: boolean) {
    await saveGroupSetAdmin(id, name, content, isGlobal);
    revalidatePath('/admin/groups/custom');
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard/custom/groups');
    return { success: true };
}

export async function deleteCustomGroup(id: string) {
    // Get the config to find userId
    const groups = await getAllGroupSetsAdmin();
    const group = groups.find(g => g.id === id);
    if (!group || !group.userId) {
        throw new Error('配置不存在');
    }
    await db.deleteCustomGroup(id, group.userId);
    revalidatePath('/admin/groups/custom');
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard/custom/groups');
    return { success: true };
}
