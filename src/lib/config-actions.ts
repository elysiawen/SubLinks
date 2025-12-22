'use server'

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { ConfigSet } from './database/interface';

export { type ConfigSet };

// --- Groups Management ---

export async function getGroupSets(): Promise<ConfigSet[]> {
    const sets = await db.getCustomGroups();
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveGroupSet(id: string | null, name: string, content: string) {
    await db.saveCustomGroup(id, name, content);
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard'); // Dropdowns update
    return { success: true };
}

export async function deleteGroupSet(id: string) {
    await db.deleteCustomGroup(id);
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard');
}

// --- Rules Management ---

export async function getRuleSets(): Promise<ConfigSet[]> {
    const sets = await db.getCustomRules();
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveRuleSet(id: string | null, name: string, content: string) {
    await db.saveCustomRule(id, name, content);
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteRuleSet(id: string) {
    await db.deleteCustomRule(id);
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard');
}

