'use server'

import { redis } from '@/lib/redis';
import { generateToken } from '@/lib/utils';
import { hashPassword } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Global Config
export async function getGlobalConfig() {
    const data = await redis.get('config:global');
    return data ? JSON.parse(data) : {};
}

export async function updateGlobalConfig(formData: FormData) {
    const upstreamUrl = formData.get('upstreamUrl');
    const cacheDuration = parseInt(formData.get('cacheDuration') as string);
    const uaWhitelist = (formData.get('uaWhitelist') as string).split(',').map(s => s.trim()).filter(s => s);

    await redis.set('config:global', JSON.stringify({ upstreamUrl, cacheDuration, uaWhitelist }));

    // Immediately cache the upstream subscription
    if (upstreamUrl) {
        const { refreshUpstreamCache } = await import('@/lib/analysis');
        await refreshUpstreamCache();
    }

    revalidatePath('/admin');
}

export async function clearCache() {
    await redis.del('cache:subscription');
    revalidatePath('/admin');
}

// User Management
export async function getUsers() {
    // 1. Get all usernames from index
    // Note: Previously index stored tokens. Now it stores usernames.
    // Migration: We assume index is now list of usernames.

    // Cleaning up old bad data if any (optional but good)
    const keys = await redis.smembers('users:index');
    if (!keys || keys.length === 0) return [];

    const users = await Promise.all(keys.map(async (key) => {
        // key here is username
        const dataStr = await redis.get(`user:${key}`);
        if (!dataStr) return null;
        const data = JSON.parse(dataStr);
        return { username: key, ...data };
    }));

    return users.filter(u => u !== null);
}

export async function createUser(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const rules = formData.get('customRules') as string;
    const role = formData.get('role') || 'user';
    const status = 'active';

    if (!username || !password) return { error: 'Missing fields' };

    // Check existing
    if (await redis.exists(`user:${username}`)) {
        return { error: 'User already exists' };
    }

    const hashedPassword = await hashPassword(password);

    // 1. Create User
    await redis.sadd('users:index', username);
    await redis.set(`user:${username}`, JSON.stringify({
        password: hashedPassword,
        role,
        status,
        // customRules: rules, // User-level rules? Or simple default sub rules. Let's put it in default sub.
        createdAt: Date.now()
    }));

    // 2. Create Default Subscription
    const token = generateToken();
    const subData = {
        token,
        username,
        name: '默认订阅', // Default Sub Name
        customRules: rules || '',
        enabled: true,
        createdAt: Date.now()
    };
    await redis.set(`sub:${token}`, JSON.stringify(subData));
    await redis.sadd(`user:${username}:subs`, token);

    revalidatePath('/admin');
    return { success: true };
}

export async function updateUserStatus(username: string, status: string) {
    const dataStr = await redis.get(`user:${username}`);
    if (dataStr) {
        const data = JSON.parse(dataStr);
        data.status = status;
        await redis.set(`user:${username}`, JSON.stringify(data));
        revalidatePath('/admin');
    }
}

export async function updateUserRules(username: string, rules: string) {
    const dataStr = await redis.get(`user:${username}`);
    if (dataStr) {
        const data = JSON.parse(dataStr);
        data.customRules = rules;
        await redis.set(`user:${username}`, JSON.stringify(data));
        revalidatePath('/admin');
    }
}

export async function updateUser(oldUsername: string, newUsername: string, newPassword?: string) {
    // Get existing user data
    const dataStr = await redis.get(`user:${oldUsername}`);
    if (!dataStr) return { error: 'User not found' };

    const data = JSON.parse(dataStr);

    // If username changed, check if new username exists
    if (oldUsername !== newUsername) {
        if (await redis.exists(`user:${newUsername}`)) {
            return { error: '新用户名已存在' };
        }

        // Update username in index
        await redis.srem('users:index', oldUsername);
        await redis.sadd('users:index', newUsername);

        // Delete old user key
        await redis.del(`user:${oldUsername}`);

        // Update all subscriptions
        const subTokens = await redis.smembers(`user:${oldUsername}:subs`);
        if (subTokens && subTokens.length > 0) {
            for (const token of subTokens) {
                const subStr = await redis.get(`sub:${token}`);
                if (subStr) {
                    const subData = JSON.parse(subStr);
                    subData.username = newUsername;
                    await redis.set(`sub:${token}`, JSON.stringify(subData));
                }
            }

            // Move subscription set
            await redis.rename(`user:${oldUsername}:subs`, `user:${newUsername}:subs`);
        }
    }

    // Update password if provided
    if (newPassword) {
        data.password = await hashPassword(newPassword);
    }

    // Save updated user data
    await redis.set(`user:${newUsername}`, JSON.stringify(data));

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteUser(username: string) {
    await redis.srem('users:index', username);
    await redis.del(`user:${username}`);
    revalidatePath('/admin');
}
