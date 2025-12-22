'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function saveCustomRule(id: string | null, name: string, content: string) {
    await db.saveCustomRule(id, name, content);
    revalidatePath('/admin/rules/custom');
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteCustomRule(id: string) {
    await db.deleteCustomRule(id);
    revalidatePath('/admin/rules/custom');
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard');
    return { success: true };
}
