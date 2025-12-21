'use server'

import { redis } from '@/lib/redis';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

export interface ConfigSet {
    id: string;
    name: string;
    content: string; // YAML content
    updatedAt: number;
}

// --- Groups Management ---

export async function getGroupSets(): Promise<ConfigSet[]> {
    const keys = await redis.keys('custom:groups:*');
    if (keys.length === 0) return [];

    const sets = await Promise.all(keys.map(async (key) => {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    }));

    return sets.filter(s => s !== null).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveGroupSet(id: string | null, name: string, content: string) {
    const newId = id || nanoid(8);
    const data: ConfigSet = {
        id: newId,
        name,
        content,
        updatedAt: Date.now()
    };
    await redis.set(`custom:groups:${newId}`, JSON.stringify(data));
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard'); // Dropdowns update
    return { success: true, id: newId };
}

export async function deleteGroupSet(id: string) {
    await redis.del(`custom:groups:${id}`);
    revalidatePath('/admin/groups');
    revalidatePath('/dashboard');
}

// --- Rules Management ---

export async function getRuleSets(): Promise<ConfigSet[]> {
    const keys = await redis.keys('custom:rules:*');
    if (keys.length === 0) return [];

    const sets = await Promise.all(keys.map(async (key) => {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    }));

    return sets.filter(s => s !== null).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveRuleSet(id: string | null, name: string, content: string) {
    const newId = id || nanoid(8);
    const data: ConfigSet = {
        id: newId,
        name,
        content,
        updatedAt: Date.now()
    };
    await redis.set(`custom:rules:${newId}`, JSON.stringify(data));
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard');
    return { success: true, id: newId };
}

export async function deleteRuleSet(id: string) {
    await redis.del(`custom:rules:${id}`);
    revalidatePath('/admin/rules');
    revalidatePath('/dashboard');
}
