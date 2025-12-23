'use server'

import { db } from '@/lib/db';
import { generateToken } from '@/lib/utils';
import { hashPassword } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { SubData } from '@/lib/database/interface';

// Global Config
export async function getGlobalConfig() {
    return await db.getGlobalConfig();
}

export async function updateGlobalConfig(formData: FormData) {
    const uaWhitelist = (formData.get('uaWhitelist') as string).split(',').map(s => s.trim()).filter(s => s);

    const logRetentionDays = parseInt(formData.get('logRetentionDays') as string);

    // Get existing config to preserve upstreamUrl and maxUserSubscriptions
    const existingConfig = await db.getGlobalConfig();
    const upstreamUrl = existingConfig.upstreamUrl; // Preserve existing

    // Parse maxUserSubscriptions, preserve existing value if not provided
    const maxUserSubscriptionsStr = formData.get('maxUserSubscriptions') as string;
    const maxUserSubscriptions = maxUserSubscriptionsStr
        ? parseInt(maxUserSubscriptionsStr) || 0
        : existingConfig.maxUserSubscriptions || 0;

    await db.setGlobalConfig({
        upstreamUrl, // Explicitly preserve
        uaWhitelist,
        logRetentionDays,
        maxUserSubscriptions
    });

    // Trigger cleanup immediately
    if (logRetentionDays > 0) {
        await db.cleanupLogs(logRetentionDays);
    }

    revalidatePath('/admin');
}

export async function clearCache() {
    await db.deleteCache('cache:subscription');
    revalidatePath('/admin');
}

export async function clearLogs(days: number = 30) {
    if (days < 0) return { error: 'Invalid retention days' };

    if (days === 0) {
        await db.deleteAllLogs();
    } else {
        await db.cleanupLogs(days);
    }

    revalidatePath('/admin/logs');
    revalidatePath('/admin/settings');
    return { success: true };
}

// User Management
export async function getUsers() {
    return await db.getAllUsers();
}

export async function createUser(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const rules = formData.get('customRules') as string;
    const role = (formData.get('role') as string) || 'user';
    const status = 'active';

    if (!username || !password) return { error: 'Missing fields' };

    // Check existing
    if (await db.userExists(username)) {
        return { error: 'User already exists' };
    }

    const hashedPassword = await hashPassword(password);

    // 1. Create User
    await db.setUser(username, {
        password: hashedPassword,
        role,
        status,
        createdAt: Date.now()
    });

    // Get default or first upstream source
    const upstreamSources = await db.getUpstreamSources();
    let selectedSources: string[] = [];

    if (upstreamSources.length > 0) {
        // Find default source
        const defaultSource = upstreamSources.find(s => s.isDefault);
        if (defaultSource) {
            selectedSources = [defaultSource.name];
        } else {
            // Use first source if no default
            selectedSources = [upstreamSources[0].name];
        }
    }

    // 2. Create Default Subscription
    const token = generateToken();
    const subData: SubData = {
        username,
        remark: '默认订阅',
        customRules: rules || '',
        groupId: 'default',
        ruleId: 'default',
        selectedSources, // Only default or first source
        enabled: true,
        createdAt: Date.now()
    };
    await db.createSubscription(token, username, subData);

    revalidatePath('/admin');
    return { success: true };
}

export async function updateUserStatus(username: string, status: string) {
    const user = await db.getUser(username);
    if (user) {
        user.status = status;
        await db.setUser(username, user);
        revalidatePath('/admin');
    }
}

export async function updateUser(oldUsername: string, newUsername: string, newPassword?: string) {
    // Get existing user data
    const user = await db.getUser(oldUsername);
    if (!user) return { error: 'User not found' };

    // If username changed, check if new username exists
    if (oldUsername !== newUsername) {
        if (await db.userExists(newUsername)) {
            return { error: '新用户名已存在' };
        }

        // Update password if provided
        if (newPassword) {
            user.password = await hashPassword(newPassword);
        }

        // 1. Create new user record
        await db.setUser(newUsername, user);

        // 2. Migrate subscriptions
        const subs = await db.getUserSubscriptions(oldUsername);
        for (const sub of subs) {
            const token = sub.token;
            const { token: _, ...subData } = sub;
            subData.username = newUsername;
            await db.updateSubscription(token, subData);
        }

        // 3. Delete old user
        await db.deleteUser(oldUsername);
    } else {
        // Just password update
        if (newPassword) {
            user.password = await hashPassword(newPassword);
            await db.setUser(oldUsername, user);
        }
    }

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteUser(username: string) {
    // Delete all subscriptions for this user first
    const userSubs = await db.getUserSubscriptions(username);
    for (const sub of userSubs) {
        await db.deleteSubscription(sub.token, username);
    }

    // Then delete the user
    await db.deleteUser(username);
    revalidatePath('/admin/users');
}
