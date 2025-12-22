'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function saveCustomGroup(id: string | null, name: string, content: string) {
    await db.saveCustomGroup(id, name, content);
    revalidatePath('/admin/groups/custom');
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteCustomGroup(id: string) {
    await db.deleteCustomGroup(id);
    revalidatePath('/admin/groups/custom');
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard');
    return { success: true };
}
